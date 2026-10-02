/**
 * Conversation + message repository.
 *
 * Two bugs are fixed here structurally:
 *  - `unreadCount` used to be derived from the single "last message" row, so the
 *    badge could only ever show 0 or 1. It is now a real aggregate.
 *  - private 1:1 threads used a check-then-insert with no database guarantee, so
 *    two concurrent opens created duplicate DM threads. `Conversation.dmKey`
 *    now has a partial UNIQUE index and inserts are `INSERT OR IGNORE`.
 */
import { all, execute, first, type BindValue } from '../db'
import { badRequestError, forbiddenError, notFoundError } from '../api'
import { newId } from '../ids'
import { chunk, inCondition } from '../sql'
import { buildConversationDTO, type AuthorRow, type ConversationRow } from '../serialize'
import type { ConversationDTO, MessageDTO } from '../types'

const MAX_GROUP_MEMBERS = 50

// ── Membership ───────────────────────────────────────────────────────────────

/**
 * Verifies the user belongs to the conversation.
 *
 * `ConversationMember` has no `role` column — only `CommunityMember` does. An
 * earlier version selected `cm.role` here, which made every message send and
 * every membership check fail with `no such column: cm.role`.
 */
async function requireMembership(
  conversationId: string,
  userId: string,
): Promise<{ id: string; lastReadAt: string }> {
  const row = await first<{ id: string; lastReadAt: string }>(
    `SELECT cm.id, cm.lastReadAt
       FROM ConversationMember cm
      WHERE cm.conversationId = ? AND cm.userId = ?`,
    [conversationId, userId],
  )
  if (!row) throw forbiddenError('Kamu bukan anggota percakapan ini')
  return row
}

export async function assertMember(conversationId: string, userId: string): Promise<void> {
  await requireMembership(conversationId, userId)
}

async function loadConversationRow(
  conversationId: string,
  currentUserId: string,
): Promise<ConversationRow | null> {
  const conversation = await first<{ id: string; type: string; name: string | null }>(
    `SELECT id, type, name FROM Conversation WHERE id = ?`,
    [conversationId],
  )
  if (!conversation) return null

  const memberRows = await all<{
    userId: string
    lastReadAt: string
    id: string
    username: string
    displayName: string
    avatarUrl: string | null
    verified: number
  }>(
    `SELECT cm.userId, cm.lastReadAt,
            u.id, u.username, u.displayName, u.avatarUrl, u.verified
       FROM ConversationMember cm
       JOIN User u ON u.id = cm.userId
      WHERE cm.conversationId = ?
      ORDER BY cm.joinedAt ASC`,
    [conversationId],
  )

  const members = memberRows.map((row) => ({
    userId: row.userId,
    lastReadAt: row.lastReadAt,
    user: {
      id: row.id,
      username: row.username,
      displayName: row.displayName,
      avatarUrl: row.avatarUrl,
      verified: row.verified,
    } satisfies AuthorRow,
  }))

  const lastMessage = await first<MessageDTO & { id: string }>(
    `SELECT id, conversationId, senderId, content, createdAt
       FROM Message
      WHERE conversationId = ?
      ORDER BY id DESC
      LIMIT 1`,
    [conversationId],
  )

  const unreadCount = await unreadCountFor(conversationId, currentUserId)

  return {
    id: conversation.id,
    type: conversation.type,
    name: conversation.name,
    updatedAt: '',
    members,
    lastMessage: lastMessage ?? null,
    unreadCount,
  }
}

async function unreadCountFor(conversationId: string, currentUserId: string): Promise<number> {
  const row = await first<{ n: number }>(
    `SELECT COUNT(m.id) AS n
       FROM ConversationMember cm
       JOIN Message m
         ON m.conversationId = cm.conversationId
        AND m.createdAt > cm.lastReadAt
        AND m.senderId != ?
      WHERE cm.conversationId = ? AND cm.userId = ?`,
    [currentUserId, conversationId, currentUserId],
  )
  return row?.n ?? 0
}

export async function getConversation(
  conversationId: string,
  currentUserId: string,
): Promise<ConversationDTO> {
  await requireMembership(conversationId, currentUserId)
  const row = await loadConversationRow(conversationId, currentUserId)
  if (!row) throw notFoundError('Percakapan tidak ditemukan')
  return buildConversationDTO(row, currentUserId)
}

// ── Listing ──────────────────────────────────────────────────────────────────

/** All conversations for a user, most recently active first, with real badges. */
export async function listConversations(currentUserId: string): Promise<ConversationDTO[]> {
  const ids = await all<{ id: string }>(
    `SELECT conversationId AS id FROM ConversationMember WHERE userId = ?`,
    [currentUserId],
  )
  if (ids.length === 0) return []

  const conversationIds = ids.map((r) => r.id)
  const rows: ConversationRow[] = []

  for (const group of chunk(conversationIds)) {
    // Each query below joins a different set of tables, so the column reference
    // must be built per query. Reusing one aliased condition (`cm.conversationId`)
    // in statements that do not define `cm` is a hard SQL error — it made
    // GET /api/conversations fail outright.
    const onMember = inCondition('cm.conversationId', group)
    const onConversation = inCondition('c.id', group)
    const onMessage = inCondition('conversationId', group)
    if (!onMember || !onConversation || !onMessage) continue
    const where = onMember
    const memberRows = await all<{
      conversationId: string
      userId: string
      lastReadAt: string
      id: string
      username: string
      displayName: string
      avatarUrl: string | null
      verified: number
    }>(
      `SELECT cm.conversationId, cm.userId, cm.lastReadAt,
              u.id, u.username, u.displayName, u.avatarUrl, u.verified
         FROM ConversationMember cm
         JOIN User u ON u.id = cm.userId
        WHERE ${where.sql}`,
      where.params,
    )

    const conversations = await all<{ id: string; type: string; name: string | null; updatedAt: string }>(
      `SELECT c.id, c.type, c.name, c.updatedAt
         FROM Conversation c
        WHERE ${onConversation.sql}`,
      onConversation.params,
    )

    // Last message per conversation, without N+1.
    const lastMessages = await all<MessageDTO>(
      `SELECT m.id, m.conversationId, m.senderId, m.content, m.createdAt
         FROM Message m
         JOIN (
           SELECT conversationId, MAX(id) AS maxId
             FROM Message
            WHERE ${onMessage.sql}
            GROUP BY conversationId
         ) latest ON latest.maxId = m.id`,
      onMessage.params,
    )
    const lastByConv = new Map(lastMessages.map((m) => [m.conversationId, m]))

    // Unread counts per conversation, without N+1.
    const unreadRows = await all<{ conversationId: string; n: number }>(
      `SELECT cm.conversationId AS conversationId, COUNT(m.id) AS n
         FROM ConversationMember cm
         JOIN Message m
           ON m.conversationId = cm.conversationId
          AND m.createdAt > cm.lastReadAt
          AND m.senderId != ?
        WHERE cm.userId = ? AND ${where.sql}
        GROUP BY cm.conversationId`,
      [currentUserId, currentUserId, ...where.params],
    )
    const unreadByConv = new Map(unreadRows.map((r) => [r.conversationId, r.n]))

    for (const conversation of conversations) {
      rows.push({
        id: conversation.id,
        type: conversation.type,
        name: conversation.name,
        updatedAt: conversation.updatedAt,
        members: memberRows
          .filter((m) => m.conversationId === conversation.id)
          .map((row) => ({
            userId: row.userId,
            lastReadAt: row.lastReadAt,
            user: {
              id: row.id,
              username: row.username,
              displayName: row.displayName,
              avatarUrl: row.avatarUrl,
              verified: row.verified,
            } satisfies AuthorRow,
          })),
        lastMessage: lastByConv.get(conversation.id) ?? null,
        unreadCount: unreadByConv.get(conversation.id) ?? 0,
      })
    }
  }

  rows.sort((a, b) => (b.lastMessage?.createdAt ?? b.updatedAt).localeCompare(a.lastMessage?.createdAt ?? a.updatedAt))
  return rows.map((row) => buildConversationDTO(row, currentUserId))
}

/** Total unread messages across every conversation (nav badge). */
export async function totalUnreadCount(currentUserId: string): Promise<number> {
  const row = await first<{ n: number }>(
    `SELECT COUNT(m.id) AS n
       FROM ConversationMember cm
       JOIN Message m
         ON m.conversationId = cm.conversationId
        AND m.createdAt > cm.lastReadAt
        AND m.senderId != ?
      WHERE cm.userId = ?`,
    [currentUserId, currentUserId],
  )
  return row?.n ?? 0
}

// ── Creation ─────────────────────────────────────────────────────────────────

function dmKeyFor(a: string, b: string): string {
  return [a, b].sort().join(':')
}

export interface CreateConversationResult {
  conversation: ConversationDTO
  created: boolean
}

/** Finds or creates the 1:1 thread with another user. */
export async function openPrivateConversation(
  currentUserId: string,
  otherUserId: string,
): Promise<CreateConversationResult> {
  if (currentUserId === otherUserId) {
    throw badRequestError('Kamu tidak bisa mengirim pesan ke diri sendiri')
  }
  const other = await first<{ id: string }>(`SELECT id FROM User WHERE id = ?`, [otherUserId])
  if (!other) throw notFoundError('Pengguna tidak ditemukan')

  const dmKey = dmKeyFor(currentUserId, otherUserId)

  const existing = await first<{ id: string }>(
    `SELECT id FROM Conversation WHERE dmKey = ?`,
    [dmKey],
  )
  if (existing) {
    return {
      conversation: await getConversation(existing.id, currentUserId),
      created: false,
    }
  }

  const conversationId = newId()
  const now = new Date().toISOString()

  // `INSERT OR IGNORE` + re-read makes concurrent opens converge on one thread.
  const inserted = await execute(
    `INSERT OR IGNORE INTO Conversation (id, type, name, dmKey, createdAt, updatedAt)
     VALUES (?, 'private', NULL, ?, ?, ?)`,
    [conversationId, dmKey, now, now],
  )
  const resolvedId =
    inserted > 0
      ? conversationId
      : (
          await first<{ id: string }>(`SELECT id FROM Conversation WHERE dmKey = ?`, [dmKey])
        )?.id ?? conversationId

  if (inserted > 0) {
    await execute(
      `INSERT OR IGNORE INTO ConversationMember (id, conversationId, userId, lastReadAt, joinedAt)
       VALUES (?, ?, ?, ?, ?), (?, ?, ?, ?, ?)`,
      [
        newId(), resolvedId, currentUserId, now, now,
        newId(), resolvedId, otherUserId, now, now,
      ],
    )
  }

  return {
    conversation: await getConversation(resolvedId, currentUserId),
    created: inserted > 0,
  }
}

/** Creates a group conversation. */
export async function createGroupConversation(
  creatorId: string,
  name: string,
  participantIds: string[],
): Promise<ConversationDTO> {
  const trimmed = name.trim()
  if (trimmed.length < 1 || trimmed.length > 60) {
    throw badRequestError('Nama grup harus antara 1 dan 60 karakter')
  }

  const unique = [...new Set([creatorId, ...participantIds])]
  if (unique.length < 3) throw badRequestError('Grup minimal harus memiliki 3 anggota')
  if (unique.length > MAX_GROUP_MEMBERS) {
    throw badRequestError(`Maksimal ${MAX_GROUP_MEMBERS} anggota per grup`)
  }

  const onId = inCondition('id', unique)
  if (!onId) throw badRequestError('Daftar peserta tidak valid')
  const found = await all<{ id: string }>(
    `SELECT id FROM User WHERE ${onId.sql}`,
    onId.params,
  )
  if (found.length !== unique.length) throw notFoundError('Some peserta tidak ditemukan')

  const conversationId = newId()
  const now = new Date().toISOString()
  await execute(
    `INSERT INTO Conversation (id, type, name, dmKey, createdAt, updatedAt)
     VALUES (?, 'group', ?, NULL, ?, ?)`,
    [conversationId, trimmed, now, now],
  )
  for (const userId of unique) {
    await execute(
      `INSERT OR IGNORE INTO ConversationMember (id, conversationId, userId, lastReadAt, joinedAt)
       VALUES (?, ?, ?, ?, ?)`,
      [newId(), conversationId, userId, now, now],
    )
  }
  return getConversation(conversationId, creatorId)
}

// ── Messages ─────────────────────────────────────────────────────────────────

export async function listMessages(
  conversationId: string,
  currentUserId: string,
  options: { limit: number; cursor?: string | null },
): Promise<{ messages: MessageDTO[]; nextCursor: string | null }> {
  await requireMembership(conversationId, currentUserId)

  const clauses = ['conversationId = ?']
  const params: BindValue[] = [conversationId]
  if (options.cursor) {
    clauses.push('id < ?')
    params.push(options.cursor)
  }

  const rows = await all<MessageDTO>(
    `SELECT id, conversationId, senderId, content, createdAt
       FROM Message
      WHERE ${clauses.join(' AND ')}
      ORDER BY id DESC
      LIMIT ?`,
    [...params, options.limit + 1],
  )

  const hasMore = rows.length > options.limit
  const page = hasMore ? rows.slice(0, options.limit) : rows
  // Return oldest-first for the chat transcript.
  page.reverse()
  return { messages: page, nextCursor: hasMore ? (rows[options.limit - 1]?.id ?? null) : null }
}

export async function sendMessage(
  conversationId: string,
  senderId: string,
  content: string,
): Promise<MessageDTO> {
  await requireMembership(conversationId, senderId)

  const text = content.trim()
  if (text.length === 0) throw badRequestError('Pesan tidak boleh kosong')
  if (text.length > 2000) throw badRequestError('Pesan maksimal 2000 karakter')

  const id = newId()
  const now = new Date().toISOString()
  await execute(
    `INSERT INTO Message (id, conversationId, senderId, content, createdAt) VALUES (?, ?, ?, ?, ?)`,
    [id, conversationId, senderId, text, now],
  )
  // Bumping updatedAt is what floats the thread to the top of the list.
  await execute(`UPDATE Conversation SET updatedAt = ? WHERE id = ?`, [now, conversationId])

  return { id, conversationId, senderId, content: text, createdAt: now }
}

/** Marks a conversation read for one member. */
export async function markConversationRead(
  conversationId: string,
  userId: string,
): Promise<void> {
  await requireMembership(conversationId, userId)
  await execute(
    `UPDATE ConversationMember SET lastReadAt = ? WHERE conversationId = ? AND userId = ?`,
    [new Date().toISOString(), conversationId, userId],
  )
}

/** Ids of every member except the sender — used for realtime fan-out. */
export async function recipientIds(conversationId: string, senderId: string): Promise<string[]> {
  const rows = await all<{ userId: string }>(
    `SELECT userId FROM ConversationMember WHERE conversationId = ? AND userId != ?`,
    [conversationId, senderId],
  )
  return rows.map((r) => r.userId)
}