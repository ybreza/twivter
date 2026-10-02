/**
 * Community repository.
 */
import { all, execute, first, type BindValue } from '../db'
import { badRequestError, conflictError, forbiddenError, notFoundError } from '../api'
import { newId } from '../ids'
import { inCondition, likeTerm } from '../sql'
import { buildCommunityDTO, type AuthorRow } from '../serialize'
import type { AuthorDTO, CommunityDTO } from '../types'

interface CommunityRow {
  id: string
  name: string
  slug: string
  description: string | null
  coverUrl: string | null
  createdAt: string
  ownerId: string
  o_id: string
  o_username: string
  o_displayName: string
  o_avatarUrl: string | null
  o_verified: number
}

const COMMUNITY_SELECT = `
  SELECT c.id, c.name, c.slug, c.description, c.coverUrl, c.createdAt, c.ownerId,
         u.id          AS o_id,
         u.username    AS o_username,
         u.displayName AS o_displayName,
         u.avatarUrl   AS o_avatarUrl,
         u.verified    AS o_verified
    FROM Community c
    JOIN User u ON u.id = c.ownerId
`

function toRow(row: CommunityRow) {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    coverUrl: row.coverUrl,
    createdAt: row.createdAt,
    owner: {
      id: row.o_id,
      username: row.o_username,
      displayName: row.o_displayName,
      avatarUrl: row.o_avatarUrl,
      verified: row.o_verified,
    } satisfies AuthorRow,
  }
}

async function membershipMap(
  communityIds: string[],
  userId?: string | null,
): Promise<Map<string, { membersCount: number; isMember: boolean; role: string | null }>> {
  const out = new Map<string, { membersCount: number; isMember: boolean; role: string | null }>()
  if (communityIds.length === 0) return out
  for (const id of communityIds) out.set(id, { membersCount: 0, isMember: false, role: null })

  for (const group of [communityIds.slice(0, 90), communityIds.slice(90)].filter((g) => g.length)) {
    const where = inCondition('communityId', group)
    if (!where) continue
    const counts = await all<{ communityId: string; n: number }>(
      `SELECT communityId, COUNT(*) AS n FROM CommunityMember WHERE ${where.sql} GROUP BY communityId`,
      where.params,
    )
    for (const row of counts) {
      const entry = out.get(row.communityId)
      if (entry) entry.membersCount = row.n
    }
    if (userId) {
      const mine = await all<{ communityId: string; role: string }>(
        `SELECT communityId, role FROM CommunityMember WHERE userId = ? AND ${where.sql}`,
        [userId, ...where.params],
      )
      for (const row of mine) {
        const entry = out.get(row.communityId)
        if (entry) {
          entry.isMember = true
          entry.role = row.role
        }
      }
    }
  }
  return out
}

export async function listCommunities(
  options: { query?: string; limit?: number; currentUserId?: string | null },
): Promise<CommunityDTO[]> {
  const clauses: string[] = []
  const params: BindValue[] = []
  if (options.query) {
    clauses.push(`(c.name LIKE ? ESCAPE '\\' OR c.description LIKE ? ESCAPE '\\')`)
    const term = likeTerm(options.query)
    params.push(term, term)
  }
  const rows = await all<CommunityRow>(
    `${COMMUNITY_SELECT}${clauses.length ? ` WHERE ${clauses.join(' AND ')}` : ''}
     ORDER BY c.id DESC LIMIT ?`,
    [...params, options.limit ?? 50],
  )
  const membership = await membershipMap(
    rows.map((r) => r.id),
    options.currentUserId,
  )
  return rows.map((row) => buildCommunityDTO(toRow(row), membership.get(row.id)))
}

export async function getCommunity(
  idOrSlug: string,
  currentUserId?: string | null,
): Promise<CommunityDTO> {
  const row = await findCommunityRow(idOrSlug)
  if (!row) throw notFoundError('Komunitas tidak ditemukan')
  const membership = await membershipMap([row.id], currentUserId)
  return buildCommunityDTO(toRow(row), membership.get(row.id))
}

async function findCommunityRow(idOrSlug: string): Promise<CommunityRow | null> {
  const needle = idOrSlug.trim()
  return (
    (await first<CommunityRow>(`${COMMUNITY_SELECT} WHERE c.id = ?`, [needle])) ??
    (await first<CommunityRow>(`${COMMUNITY_SELECT} WHERE c.slugLower = ?`, [needle.toLowerCase()]))
  )
}

export interface CommunityDetail {
  community: CommunityDTO
  members: (AuthorDTO & { role: string })[]
}

/** Community plus its member list, ranked owner → admin → member. */
export async function getCommunityDetail(
  idOrSlug: string,
  currentUserId?: string | null,
): Promise<CommunityDetail> {
  const row = await findCommunityRow(idOrSlug)
  if (!row) throw notFoundError('Komunitas tidak ditemukan')

  const membership = await membershipMap([row.id], currentUserId)
  const members = await all<{
    role: string
    id: string
    username: string
    displayName: string
    avatarUrl: string | null
    verified: number
  }>(
    `SELECT cm.role, u.id, u.username, u.displayName, u.avatarUrl, u.verified
       FROM CommunityMember cm
       JOIN User u ON u.id = cm.userId
      WHERE cm.communityId = ?
      LIMIT 50`,
    [row.id],
  )

  const rank = (role: string) => (role === 'owner' ? 0 : role === 'admin' ? 1 : 2)
  members.sort((a, b) => rank(a.role) - rank(b.role) || a.id.localeCompare(b.id))

  return {
    community: buildCommunityDTO(toRow(row), membership.get(row.id)),
    members: members.map((m) => ({
      id: m.id,
      username: m.username,
      displayName: m.displayName,
      avatarUrl: m.avatarUrl,
      verified: m.verified === 1,
      role: m.role,
    })),
  }
}

// ── Mutations ────────────────────────────────────────────────────────────────

/** Unique slug with a numeric suffix, backstopped by a UNIQUE index. */
async function allocateSlug(name: string): Promise<string> {
  const base =
    name
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'komunitas'
  for (let attempt = 0; attempt < 50; attempt++) {
    const candidate = attempt === 0 ? base : `${base}-${attempt + 1}`
    const clash = await first<{ id: string }>(
      `SELECT id FROM Community WHERE slugLower = ?`,
      [candidate],
    )
    if (!clash) return candidate
  }
  return `${base}-${newId().slice(0, 8)}`
}

export async function createCommunity(
  ownerId: string,
  name: string,
  description?: string | null,
): Promise<CommunityDTO> {
  const trimmed = name.trim()
  if (trimmed.length < 3) throw badRequestError('Nama komunitas minimal 3 karakter')
  if (trimmed.length > 50) throw badRequestError('Nama komunitas maksimal 50 karakter')
  if (description && description.length > 280) {
    throw badRequestError('Deskripsi maksimal 280 karakter')
  }

  const id = newId()
  const slug = await allocateSlug(trimmed)
  const now = new Date().toISOString()

  await execute(
    `INSERT INTO Community (id, name, slug, slugLower, description, ownerId, createdAt)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, trimmed, slug, slug, description ?? null, ownerId, now],
  )
  await execute(
    `INSERT INTO CommunityMember (id, communityId, userId, role, joinedAt) VALUES (?, ?, ?, 'owner', ?)`,
    [newId(), id, ownerId, now],
  )
  return getCommunity(id, ownerId)
}

/** Idempotent join. The UNIQUE index turns a double-join into a no-op. */
export async function joinCommunity(
  communityId: string,
  userId: string,
): Promise<{ isMember: boolean; membersCount: number }> {
  const community = await first<{ id: string }>(`SELECT id FROM Community WHERE id = ?`, [communityId])
  if (!community) throw notFoundError('Komunitas tidak ditemukan')

  await execute(
    `INSERT OR IGNORE INTO CommunityMember (id, communityId, userId, role, joinedAt)
     VALUES (?, ?, ?, 'member', ?)`,
    [newId(), communityId, userId, new Date().toISOString()],
  )
  return { isMember: true, membersCount: await countMembers(communityId) }
}

export async function leaveCommunity(
  communityId: string,
  userId: string,
): Promise<{ isMember: boolean; membersCount: number }> {
  const membership = await first<{ role: string }>(
    `SELECT role FROM CommunityMember WHERE communityId = ? AND userId = ?`,
    [communityId, userId],
  )
  if (!membership) throw notFoundError('Kamu belum menjadi anggota komunitas ini')
  if (membership.role === 'owner') {
    throw badRequestError('Pemilik komunitas tidak bisa keluar. Hapus komunitas atau alihkan kepemilikan.')
  }
  await execute(`DELETE FROM CommunityMember WHERE communityId = ? AND userId = ?`, [
    communityId,
    userId,
  ])
  return { isMember: false, membersCount: await countMembers(communityId) }
}

async function countMembers(communityId: string): Promise<number> {
  const row = await first<{ n: number }>(
    `SELECT COUNT(*) AS n FROM CommunityMember WHERE communityId = ?`,
    [communityId],
  )
  return row?.n ?? 0
}

/**
 * Community management. Previously owners were permanently stuck: they could
 * not leave (correctly) but there was also no route to edit or delete the
 * community they owned.
 */
export async function updateCommunity(
  communityId: string,
  userId: string,
  input: { name?: string; description?: string | null },
): Promise<CommunityDTO> {
  await assertOwner(communityId, userId)

  const columns: string[] = []
  const params: BindValue[] = []
  if (input.name !== undefined) {
    const trimmed = input.name.trim()
    if (trimmed.length < 3) throw badRequestError('Nama komunitas minimal 3 karakter')
    columns.push('name = ?')
    params.push(trimmed)
  }
  if (input.description !== undefined) {
    if (input.description && input.description.length > 280) {
      throw badRequestError('Deskripsi maksimal 280 karakter')
    }
    columns.push('description = ?')
    params.push(input.description)
  }
  if (columns.length === 0) return getCommunity(communityId, userId)

  params.push(communityId)
  await execute(`UPDATE Community SET ${columns.join(', ')} WHERE id = ?`, params)
  return getCommunity(communityId, userId)
}

export async function deleteCommunity(communityId: string, userId: string): Promise<void> {
  await assertOwner(communityId, userId)
  await execute(`DELETE FROM Community WHERE id = ?`, [communityId])
}

/** Changes a member's role. Only the owner may do this. */
export async function setMemberRole(
  communityId: string,
  ownerId: string,
  targetUserId: string,
  role: 'admin' | 'member',
): Promise<void> {
  await assertOwner(communityId, ownerId)
  if (role !== 'admin' && role !== 'member') {
    throw badRequestError("Role harus 'admin' atau 'member'")
  }
  if (targetUserId === ownerId) throw badRequestError('Peran pemilik tidak dapat diubah')

  const result = await execute(
    `UPDATE CommunityMember SET role = ? WHERE communityId = ? AND userId = ? AND role != 'owner'`,
    [role, communityId, targetUserId],
  )
  if (result === 0) throw notFoundError('Anggota tidak ditemukan')
}

async function assertOwner(communityId: string, userId: string): Promise<void> {
  const row = await first<{ role: string }>(
    `SELECT role FROM CommunityMember WHERE communityId = ? AND userId = ?`,
    [communityId, userId],
  )
  if (!row) throw forbiddenError('Kamu bukan anggota komunitas ini')
  if (row.role !== 'owner') throw forbiddenError('Hanya pemilik komunitas yang dapat melakukan ini')
}

/** Every community the given user belongs to. */
export async function listUserCommunities(userId: string): Promise<CommunityDTO[]> {
  const rows = await all<{ communityId: string }>(
    `SELECT communityId FROM CommunityMember WHERE userId = ?`,
    [userId],
  )
  const ids = rows.map((r) => r.communityId)
  if (ids.length === 0) return []

  const where = inCondition('c.id', ids)
  if (!where) return []
  const communities = await all<CommunityRow>(
    `${COMMUNITY_SELECT} WHERE ${where.sql} ORDER BY c.id DESC`,
    where.params,
  )
  const membership = await membershipMap(ids, userId)
  return communities.map((row) => buildCommunityDTO(toRow(row), membership.get(row.id)))
}

export { conflictError }