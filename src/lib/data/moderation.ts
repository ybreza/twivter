/**
 * Moderation repository: reports, verification requests and admin stats.
 *
 * Fixes two dead features:
 *  - nothing ever created a Verification row, so the admin "Verifikasi" queue
 *    was permanently empty. `requestVerification` below now backs a real route.
 *  - rejecting a verification left the user flagged as verified. Status changes
 *    now always write the matching `User.verified` value.
 */
import { all, execute, first, type BindValue } from '../db'
import { badRequestError, conflictError, notFoundError } from '../api'
import { newId } from '../ids'
import { inCondition, likeTerm } from '../sql'
import { loadProfiles } from './users'
import type { AuthorDTO, ProfileDTO } from '../types'

// ── Reports ──────────────────────────────────────────────────────────────────

export const REPORT_STATUSES = ['pending', 'reviewed', 'resolved', 'dismissed'] as const
export type ReportStatus = (typeof REPORT_STATUSES)[number]

export async function createReport(input: {
  reporterId: string
  targetType: 'user' | 'post'
  targetUserId: string
  targetPostId?: string | null
  reason: string
}): Promise<void> {
  const reason = input.reason.trim()
  if (reason.length < 5) throw badRequestError('Alasan laporan minimal 5 karakter')
  if (reason.length > 500) throw badRequestError('Alasan laporan maksimal 500 karakter')

  // One open report per (reporter, target). Backed by an index so the check
  // does not full-scan the table.
  const existing = await first<{ id: string }>(
    `SELECT id FROM Report
      WHERE reporterId = ? AND targetUserId = ? AND status = 'pending'
      LIMIT 1`,
    [input.reporterId, input.targetUserId],
  )
  if (existing) {
    throw conflictError('Kamu sudah melaporkan target ini dan laporannya masih ditinjau')
  }

  await execute(
    `INSERT INTO Report (id, reporterId, targetUserId, targetPostId, targetType, reason, status, createdAt)
     VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)`,
    [
      newId(),
      input.reporterId,
      input.targetUserId,
      input.targetPostId ?? null,
      input.targetType,
      reason,
      new Date().toISOString(),
    ],
  )
}

export interface AdminReport {
  id: string
  reporter: AuthorDTO
  target: AuthorDTO
  targetPost: { id: string; content: string } | null
  targetType: string
  reason: string
  status: ReportStatus
  createdAt: string
}

export async function listReports(options: {
  status?: ReportStatus | 'all'
  limit?: number
  cursor?: string | null
}): Promise<{ reports: AdminReport[]; nextCursor: string | null }> {
  const clauses: string[] = []
  const params: BindValue[] = []
  if (options.status && options.status !== 'all') {
    clauses.push('r.status = ?')
    params.push(options.status)
  }
  if (options.cursor) {
    clauses.push('r.id < ?')
    params.push(options.cursor)
  }

  const limit = options.limit ?? 50
  const rows = await all<{
    id: string
    targetType: string
    reason: string
    status: ReportStatus
    createdAt: string
    targetPostId: string | null
    targetPostContent: string | null
    rep_id: string
    rep_username: string
    rep_displayName: string
    rep_avatarUrl: string | null
    rep_verified: number
    tgt_id: string
    tgt_username: string
    tgt_displayName: string
    tgt_avatarUrl: string | null
    tgt_verified: number
  }>(
    `SELECT r.id, r.targetType, r.reason, r.status, r.createdAt,
            r.targetPostId, p.content AS targetPostContent,
            ru.id AS rep_id, ru.username AS rep_username, ru.displayName AS rep_displayName,
            ru.avatarUrl AS rep_avatarUrl, ru.verified AS rep_verified,
            tu.id AS tgt_id, tu.username AS tgt_username, tu.displayName AS tgt_displayName,
            tu.avatarUrl AS tgt_avatarUrl, tu.verified AS tgt_verified
       FROM Report r
       JOIN User ru ON ru.id = r.reporterId
       JOIN User tu ON tu.id = r.targetUserId
       LEFT JOIN Post p ON p.id = r.targetPostId
      ${clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''}
      ORDER BY r.id DESC
      LIMIT ?`,
    [...params, limit + 1],
  )

  const hasMore = rows.length > limit
  const page = hasMore ? rows.slice(0, limit) : rows
  return {
    reports: page.map((row) => ({
      id: row.id,
      targetType: row.targetType,
      reason: row.reason,
      status: row.status,
      createdAt: row.createdAt,
      targetPost:
        row.targetPostId && row.targetPostContent !== null
          ? { id: row.targetPostId, content: row.targetPostContent }
          : null,
      reporter: {
        id: row.rep_id,
        username: row.rep_username,
        displayName: row.rep_displayName,
        avatarUrl: row.rep_avatarUrl,
        verified: row.rep_verified === 1,
      },
      target: {
        id: row.tgt_id,
        username: row.tgt_username,
        displayName: row.tgt_displayName,
        avatarUrl: row.tgt_avatarUrl,
        verified: row.tgt_verified === 1,
      },
    })),
    nextCursor: hasMore ? (page[page.length - 1]?.id ?? null) : null,
  }
}

export async function updateReportStatus(reportId: string, status: ReportStatus): Promise<AdminReport> {
  if (!REPORT_STATUSES.includes(status)) {
    throw badRequestError(`status harus salah satu dari: ${REPORT_STATUSES.join(', ')}`)
  }
  const result = await execute(`UPDATE Report SET status = ? WHERE id = ?`, [status, reportId])
  if (result === 0) throw notFoundError('Laporan tidak ditemukan')

  const { reports } = await listReports({ limit: 1, status })
  const found = reports.find((r) => r.id === reportId)
  if (!found) throw notFoundError('Laporan tidak ditemukan')
  return found
}

// ── Verification ─────────────────────────────────────────────────────────────

export const VERIFICATION_STATUSES = ['pending', 'approved', 'rejected'] as const
export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number]

/**
 * Creates (or reopens) a verification request for the signed-in user.
 *
 * There was no write path for this table at all before, so the admin queue could
 * never fill up.
 */
export async function requestVerification(userId: string, reason: string): Promise<void> {
  const trimmed = reason.trim()
  if (trimmed.length < 20) throw badRequestError('Alasan minimal 20 karakter')
  if (trimmed.length > 500) throw badRequestError('Alasan maksimal 500 karakter')

  const existing = await first<{ status: string }>(
    `SELECT status FROM Verification WHERE userId = ?`,
    [userId],
  )
  if (existing?.status === 'pending') {
    throw conflictError('Permintaan verifikasi kamu sudah menunggu peninjauan')
  }

  if (existing) {
    await execute(
      `UPDATE Verification SET reason = ?, status = 'pending', note = NULL, createdAt = ? WHERE userId = ?`,
      [trimmed, new Date().toISOString(), userId],
    )
    return
  }
  await execute(
    `INSERT INTO Verification (id, userId, reason, status, createdAt) VALUES (?, ?, ?, 'pending', ?)`,
    [newId(), userId, trimmed, new Date().toISOString()],
  )
}

export interface AdminVerification {
  id: string
  user: ProfileDTO | null
  reason: string
  status: VerificationStatus
  createdAt: string
}

export async function listVerifications(options: {
  status?: VerificationStatus | 'all'
  limit?: number
  cursor?: string | null
}): Promise<{ requests: AdminVerification[]; nextCursor: string | null }> {
  const clauses: string[] = []
  const params: BindValue[] = []
  if (options.status && options.status !== 'all') {
    clauses.push('v.status = ?')
    params.push(options.status)
  }
  if (options.cursor) {
    clauses.push('v.id < ?')
    params.push(options.cursor)
  }

  const limit = options.limit ?? 50
  const rows = await all<{
    id: string
    userId: string
    reason: string
    status: VerificationStatus
    createdAt: string
  }>(
    `SELECT v.id, v.userId, v.reason, v.status, v.createdAt
       FROM Verification v
      ${clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''}
      ORDER BY v.id DESC
      LIMIT ?`,
    [...params, limit + 1],
  )

  const hasMore = rows.length > limit
  const page = hasMore ? rows.slice(0, limit) : rows
  if (page.length === 0) return { requests: [], nextCursor: null }

  // Load the profiles through the shared loader so the admin panel shows real
  // follower/post counts instead of zeroes.
  const profiles = await loadProfiles(
    page.map((r) => r.userId),
    null,
  )
  const profileById = new Map(profiles.map((p) => [p.id, p]))

  return {
    requests: page.map((row) => ({
      id: row.id,
      reason: row.reason,
      status: row.status,
      createdAt: row.createdAt,
      // Nullable by design: the admin view used to dereference this
      // unconditionally and crashed whenever the row was missing.
      user: profileById.get(row.userId) ?? null,
    })),
    nextCursor: hasMore ? (page[page.length - 1]?.id ?? null) : null,
  }
}

/**
 * Approves or rejects a verification request.
 *
 * The `User.verified` flag is always written, so rejecting a previously approved
 * request actually revokes the badge.
 */
export async function updateVerificationStatus(
  verificationId: string,
  status: 'approved' | 'rejected',
  adminNote?: string | null,
): Promise<{ id: string; status: string }> {
  if (status !== 'approved' && status !== 'rejected') {
    throw badRequestError("status harus 'approved' atau 'rejected'")
  }
  const row = await first<{ id: string; userId: string }>(
    `SELECT id, userId FROM Verification WHERE id = ?`,
    [verificationId],
  )
  if (!row) throw notFoundError('Permintaan verifikasi tidak ditemukan')

  await execute(`UPDATE Verification SET status = ?, note = ? WHERE id = ?`, [
    status,
    adminNote ?? null,
    verificationId,
  ])
  await execute(`UPDATE User SET verified = ? WHERE id = ?`, [status === 'approved' ? 1 : 0, row.userId])
  return { id: verificationId, status }
}

// ── User administration ──────────────────────────────────────────────────────

/**
 * Searches and paginates users.
 *
 * The old implementation filtered in JavaScript *after* `take`, so a search only
 * ever saw the first page of the table and pagination could never advance.
 */
export async function searchUsers(options: {
  query?: string
  role?: 'user' | 'admin' | 'all'
  limit?: number
  cursor?: string | null
}): Promise<{ users: ProfileDTO[]; nextCursor: string | null }> {
  const clauses: string[] = []
  const params: BindValue[] = []

  if (options.query) {
    const term = likeTerm(options.query.trim().toLowerCase())
    clauses.push(
      `(LOWER(u.username) LIKE ? ESCAPE '\\' OR LOWER(u.displayName) LIKE ? ESCAPE '\\' OR LOWER(u.email) LIKE ? ESCAPE '\\')`,
    )
    params.push(term, term, term)
  }
  if (options.role && options.role !== 'all') {
    clauses.push(`u.role = ?`)
    params.push(options.role)
  }
  if (options.cursor) {
    clauses.push('u.id < ?')
    params.push(options.cursor)
  }

  const limit = options.limit ?? 50
  const ids = await all<{ id: string }>(
    `SELECT u.id FROM User u
     ${clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''}
     ORDER BY u.id DESC
     LIMIT ?`,
    [...params, limit + 1],
  )

  const hasMore = ids.length > limit
  const page = hasMore ? ids.slice(0, limit) : ids
  if (page.length === 0) return { users: [], nextCursor: null }

  // Reuse the shared loader so counts and follow state stay consistent.
  const users = await loadProfiles(
    page.map((r) => r.id),
    null,
  )
  const order = new Map(page.map((r, i) => [r.id, i]))
  users.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0))

  return { users, nextCursor: hasMore ? (page[page.length - 1]?.id ?? null) : null }
}

export async function setUserRole(
  adminId: string,
  targetId: string,
  role: 'user' | 'admin',
): Promise<void> {
  if (role !== 'user' && role !== 'admin') throw badRequestError("role harus 'user' atau 'admin'")
  if (targetId === adminId) {
    throw badRequestError('Kamu tidak dapat menurunkan role-mu sendiri')
  }
  const result = await execute(`UPDATE User SET role = ? WHERE id = ?`, [role, targetId])
  if (result === 0) throw notFoundError('Pengguna tidak ditemukan')
}

export async function setUserVerified(adminId: string, targetId: string, verified: boolean): Promise<void> {
  if (targetId === adminId && !verified) {
    throw badRequestError('Kamu tidak dapat mencabut verifikasi akunmu sendiri')
  }
  const result = await execute(`UPDATE User SET verified = ? WHERE id = ?`, [
    verified ? 1 : 0,
    targetId,
  ])
  if (result === 0) throw notFoundError('Pengguna tidak ditemukan')
}

// ── Admin stats ──────────────────────────────────────────────────────────────

export interface AdminStats {
  users: number
  posts: number
  replies: number
  likes: number
  communities: number
  conversations: number
  reports: { pending: number; resolved: number }
  verifications: { pending: number }
  growth: { date: string; users: number; posts: number }[]
}

export async function getAdminStats(): Promise<AdminStats> {
  const [users, posts, replies, likes, communities, conversations, pendingReports, resolvedReports, pendingVerifications] =
    await Promise.all([
      count(`SELECT COUNT(*) AS n FROM User`),
      count(`SELECT COUNT(*) AS n FROM Post WHERE replyToId IS NULL`),
      count(`SELECT COUNT(*) AS n FROM Post WHERE replyToId IS NOT NULL`),
      count(`SELECT COUNT(*) AS n FROM Like`),
      count(`SELECT COUNT(*) AS n FROM Community`),
      count(`SELECT COUNT(*) AS n FROM Conversation`),
      count(`SELECT COUNT(*) AS n FROM Report WHERE status = 'pending'`),
      count(`SELECT COUNT(*) AS n FROM Report WHERE status = 'resolved'`),
      count(`SELECT COUNT(*) AS n FROM Verification WHERE status = 'pending'`),
    ])

  return {
    users,
    posts,
    replies,
    likes,
    communities,
    conversations,
    reports: { pending: pendingReports, resolved: resolvedReports },
    verifications: { pending: pendingVerifications },
    growth: await growthSeries(),
  }
}

async function count(sql: string, params: BindValue[] = []): Promise<number> {
  const row = await first<{ n: number }>(sql, params)
  return row?.n ?? 0
}

/**
 * New users and posts per day for the last 7 days.
 *
 * The previous version loaded every user and post created in the window into
 * memory on each dashboard load. This aggregates in SQL and bounds the scan.
 */
async function growthSeries(days = 7): Promise<AdminStats['growth']> {
  const buckets: { date: string; users: number; posts: number }[] = []
  const startOfToday = new Date()
  startOfToday.setUTCHours(0, 0, 0, 0)
  const windowStart = new Date(startOfToday.getTime() - (days - 1) * 86_400_000)

  for (let i = 0; i < days; i++) {
    buckets.push({ date: new Date(windowStart.getTime() + i * 86_400_000).toISOString().slice(0, 10), users: 0, posts: 0 })
  }

  const [userRows, postRows] = await Promise.all([
    all<{ day: string; n: number }>(
      `SELECT substr(createdAt, 1, 10) AS day, COUNT(*) AS n
         FROM User
        WHERE createdAt >= ?
        GROUP BY day`,
      [windowStart.toISOString()],
    ),
    all<{ day: string; n: number }>(
      `SELECT substr(createdAt, 1, 10) AS day, COUNT(*) AS n
         FROM Post
        WHERE createdAt >= ?
        GROUP BY day`,
      [windowStart.toISOString()],
    ),
  ])

  const byDay = new Map(buckets.map((b) => [b.date, b]))
  for (const row of userRows) {
    const bucket = byDay.get(row.day)
    if (bucket) bucket.users = row.n
  }
  for (const row of postRows) {
    const bucket = byDay.get(row.day)
    if (bucket) bucket.posts = row.n
  }
  return buckets
}

export { inCondition }