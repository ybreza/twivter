/**
 * User + social-graph repository.
 *
 * Username and email lookups go through the `usernameLower` / `emailLower`
 * columns. The old schema relied on SQLite's BINARY collation, so `Alice` and
 * `alice` could both exist and profile lookups resolved ambiguously.
 */
import { all, execute, first, type BindValue } from '../db'
import { conflictError, notFoundError } from '../api'
import { newId } from '../ids'
import { inCondition } from '../sql'
import {
  buildProfileDTOs,
  type ProfileAggregateMap,
  type ProfileRow,
} from '../serialize'
import type { ProfileDTO } from '../types'

const PROFILE_COLUMNS = `
  u.id, u.username, u.displayName, u.bio, u.website, u.location,
  u.avatarUrl, u.coverUrl, u.verified, u.role, u.createdAt
`

export function findUserById(id: string): Promise<ProfileRow | null> {
  return first<ProfileRow>(
    `SELECT ${PROFILE_COLUMNS} FROM User u WHERE u.id = ?`,
    [id],
  )
}

export function findUserByUsername(username: string): Promise<ProfileRow | null> {
  return first<ProfileRow>(
    `SELECT ${PROFILE_COLUMNS} FROM User u WHERE u.usernameLower = ?`,
    [username.trim().toLowerCase()],
  )
}

export async function requireUserByUsername(username: string): Promise<ProfileRow> {
  const user = await findUserByUsername(username)
  if (!user) throw notFoundError('Pengguna tidak ditemukan')
  return user
}

export async function requireUserById(id: string): Promise<ProfileRow> {
  const user = await findUserById(id)
  if (!user) throw notFoundError('Pengguna tidak ditemukan')
  return user
}

/** Availability check for the register/onboarding username picker. */
export type UsernameAvailability = 'empty' | 'invalid' | 'taken' | 'self' | 'free'

export async function usernameAvailability(
  username: string,
  currentUserId?: string | null,
): Promise<{ available: boolean; reason: UsernameAvailability }> {
  if (!username) return { available: false, reason: 'empty' }
  if (username.length < 3 || username.length > 20 || !/^[a-zA-Z0-9_]+$/.test(username)) {
    return { available: false, reason: 'invalid' }
  }
  const existing = await first<{ id: string }>(
    `SELECT id FROM User WHERE usernameLower = ?`,
    [username.toLowerCase()],
  )
  if (!existing) return { available: true, reason: 'free' }
  if (currentUserId && existing.id === currentUserId) return { available: true, reason: 'self' }
  return { available: false, reason: 'taken' }
}

/** Resolves a username to an id, case-insensitively. */
export async function findUserIdByUsername(username: string): Promise<string | null> {
  const row = await first<{ id: string }>(
    `SELECT id FROM User WHERE usernameLower = ?`,
    [username.trim().toLowerCase()],
  )
  return row?.id ?? null
}

// ── Bulk profile aggregates ──────────────────────────────────────────────────

/**
 * Loads followers/following/post counts and follow state for many users in a
 * fixed number of queries.
 */
export async function loadProfileAggregates(
  userIds: string[],
  currentUserId?: string | null,
): Promise<ProfileAggregateMap> {
  const agg: ProfileAggregateMap = {
    followersCount: new Map(),
    followingCount: new Map(),
    postsCount: new Map(),
    isFollowing: new Set(),
  }
  const unique = [...new Set(userIds.filter(Boolean))]
  if (unique.length === 0) return agg

  for (const group of chunkIds(unique)) {
    // Three aggregates over three *different* columns. Reusing one aliased
    // condition across them produced `followingId IN id IN (…)`, which made
    // every profile load fail.
    const onId = inCondition('id', group)
    const onFollowing = inCondition('followingId', group)
    const onFollower = inCondition('followerId', group)
    const onAuthor = inCondition('authorId', group)
    if (!onId || !onFollowing || !onFollower || !onAuthor) continue

    const rows = await all<{ kind: string; ref: string; n: number }>(
      `SELECT 'followers' AS kind, followingId AS ref, COUNT(*) AS n
         FROM Follow WHERE ${onFollowing.sql} GROUP BY followingId
       UNION ALL
       SELECT 'following', followerId, COUNT(*) FROM Follow WHERE ${onFollower.sql} GROUP BY followerId
       UNION ALL
       SELECT 'posts', authorId, COUNT(*) FROM Post
        WHERE replyToId IS NULL AND ${onAuthor.sql} GROUP BY authorId`,
      [...onFollowing.params, ...onFollower.params, ...onAuthor.params],
    )
    for (const row of rows) {
      if (row.kind === 'followers') agg.followersCount.set(row.ref, row.n)
      else if (row.kind === 'following') agg.followingCount.set(row.ref, row.n)
      else agg.postsCount.set(row.ref, row.n)
    }
  }

  if (currentUserId) {
    for (const group of chunkIds(unique)) {
      const where = inCondition('followingId', group)
      if (!where) continue
      const rows = await all<{ followingId: string }>(
        `SELECT followingId FROM Follow WHERE followerId = ? AND ${where.sql}`,
        [currentUserId, ...where.params],
      )
      for (const row of rows) agg.isFollowing.add(row.followingId)
    }
  }

  return agg
}

function chunkIds(ids: string[]): string[][] {
  const out: string[][] = []
  for (let i = 0; i < ids.length; i += 90) out.push(ids.slice(i, i + 90))
  return out
}

/** Loads profiles for many users and serialises them with their aggregates. */
export async function loadProfiles(
  userIds: string[],
  currentUserId?: string | null,
): Promise<ProfileDTO[]> {
  const unique = [...new Set(userIds.filter(Boolean))]
  if (unique.length === 0) return []

  const users: ProfileRow[] = []
  for (const group of chunkIds(unique)) {
    const where = inCondition('u.id', group)
    if (!where) continue
    users.push(
      ...(await all<ProfileRow>(`SELECT ${PROFILE_COLUMNS} FROM User u WHERE ${where.sql}`, where.params)),
    )
  }
  if (users.length === 0) return []

  const agg = await loadProfileAggregates(
    users.map((u) => u.id),
    currentUserId,
  )
  return buildProfileDTOs(users, agg, currentUserId)
}

/** Loads a single profile with counts, or throws 404. */
export async function loadProfile(username: string, currentUserId?: string | null): Promise<ProfileDTO> {
  const user = await requireUserByUsername(username)
  const [dto] = await loadProfiles([user.id], currentUserId)
  return dto
}

// ── Creation & update ────────────────────────────────────────────────────────

export interface CreateUserInput {
  email: string
  passwordHash: string
  username: string
  displayName: string
}

export async function createUser(input: CreateUserInput): Promise<string> {
  const emailLower = input.email.trim().toLowerCase()
  const usernameLower = input.username.trim().toLowerCase()

  const clash = await first<{ id: string; emailLower: string; usernameLower: string }>(
    `SELECT id, emailLower, usernameLower FROM User WHERE emailLower = ? OR usernameLower = ?`,
    [emailLower, usernameLower],
  )
  if (clash) {
    if (clash.emailLower === emailLower) throw conflictError('Email sudah digunakan')
    throw conflictError('Username sudah digunakan')
  }

  const id = newId()
  await execute(
    `INSERT INTO User (id, email, emailLower, passwordHash, username, usernameLower, displayName)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, input.email.trim(), emailLower, input.passwordHash, input.username.trim(), usernameLower, input.displayName.trim()],
  )
  return id
}

export async function assertUsernameAvailable(username: string, selfId?: string | null): Promise<void> {
  const row = await first<{ id: string }>(
    `SELECT id FROM User WHERE usernameLower = ?`,
    [username.trim().toLowerCase()],
  )
  if (row && row.id !== selfId) throw conflictError('Username sudah digunakan')
}

export interface UpdateProfileInput {
  displayName?: string
  username?: string
  bio?: string | null
  website?: string | null
  location?: string | null
  avatarUrl?: string | null
  coverUrl?: string | null
}

export async function updateProfile(userId: string, input: UpdateProfileInput): Promise<void> {
  const columns: string[] = []
  const params: BindValue[] = []

  const push = (column: string, value: BindValue) => {
    columns.push(`${column} = ?`)
    params.push(value)
  }

  if (input.displayName !== undefined) push('displayName', input.displayName)
  if (input.username !== undefined) {
    await assertUsernameAvailable(input.username, userId)
    push('username', input.username)
    push('usernameLower', input.username.toLowerCase())
  }
  if (input.bio !== undefined) push('bio', input.bio)
  if (input.website !== undefined) push('website', input.website)
  if (input.location !== undefined) push('location', input.location)
  if (input.avatarUrl !== undefined) push('avatarUrl', input.avatarUrl)
  if (input.coverUrl !== undefined) push('coverUrl', input.coverUrl)

  if (columns.length === 0) return

  push('updatedAt', new Date().toISOString())
  params.push(userId)
  await execute(`UPDATE User SET ${columns.join(', ')} WHERE id = ?`, params)
}

// ── Follow graph ─────────────────────────────────────────────────────────────

export async function isFollowing(followerId: string, followingId: string): Promise<boolean> {
  const row = await first<{ followerId: string }>(
    `SELECT followerId FROM Follow WHERE followerId = ? AND followingId = ?`,
    [followerId, followingId],
  )
  return row !== null
}

export async function followersCount(userId: string): Promise<number> {
  const row = await first<{ n: number }>(
    `SELECT COUNT(*) AS n FROM Follow WHERE followingId = ?`,
    [userId],
  )
  return row?.n ?? 0
}

/**
 * Idempotent follow.
 *
 * The unique index on (followerId, followingId) makes a double-follow
 * impossible; the `INSERT OR IGNORE` turns the resulting race into a no-op
 * instead of a 500.
 */
export async function followUser(
  followerId: string,
  followingId: string,
): Promise<{ isFollowing: boolean; created: boolean }> {
  const result = await execute(
    `INSERT OR IGNORE INTO Follow (id, followerId, followingId) VALUES (?, ?, ?)`,
    [newId(), followerId, followingId],
  )
  return { isFollowing: true, created: result > 0 }
}

export async function unfollowUser(
  followerId: string,
  followingId: string,
): Promise<{ isFollowing: boolean }> {
  await execute(`DELETE FROM Follow WHERE followerId = ? AND followingId = ?`, [
    followerId,
    followingId,
  ])
  return { isFollowing: false }
}

/** Ids the given user follows (excluding themselves). */
export async function listFollowingIds(userId: string): Promise<string[]> {
  const rows = await all<{ followingId: string }>(
    `SELECT followingId FROM Follow WHERE followerId = ?`,
    [userId],
  )
  return rows.map((r) => r.followingId)
}

/**
 * Suggests accounts to follow: most-followed, not self, not already followed.
 *
 * Ordering is explicit. The old query had no `orderBy`, so it picked an
 * arbitrary slice of the table and then counted followers one row at a time.
 */
export async function suggestUsers(
  currentUserId: string | null,
  limit = 8,
): Promise<ProfileDTO[]> {
  const clauses: string[] = []
  const params: BindValue[] = []
  if (currentUserId) {
    clauses.push(`u.id != ?`)
    params.push(currentUserId)
    clauses.push(`u.onboarded = 1`)
    clauses.push(
      `u.id NOT IN (SELECT followingId FROM Follow WHERE followerId = ?)`,
    )
    params.push(currentUserId)
  } else {
    clauses.push(`u.onboarded = 1`)
  }

  const rows = await all<{ id: string }>(
    `SELECT u.id
       FROM User u
       LEFT JOIN Follow f ON f.followingId = u.id
      ${clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''}
      GROUP BY u.id
      ORDER BY COUNT(f.followerId) DESC, u.id DESC
      LIMIT ?`,
    [...params, limit],
  )
  return loadProfiles(
    rows.map((r) => r.id),
    currentUserId,
  )
}