/**
 * Notification repository.
 *
 * The post join is a real LEFT JOIN on `Notification.postId`. Previously that
 * column was a bare string with no foreign key, so deleting a post left the
 * notification pointing at nothing and the notifications feed returned 500 for
 * that user, permanently.
 */
import { all, execute, first, type BindValue } from '../db'
import { notFoundError } from '../api'
import { newId } from '../ids'
import { inCondition } from '../sql'
import { buildNotificationDTO, type AuthorRow, type NotificationRow } from '../serialize'
import type { NotificationDTO } from '../types'

interface JoinedNotificationRow {
  id: string
  type: string
  read: number
  createdAt: string
  postId: string | null
  post_content: string | null
  a_id: string
  a_username: string
  a_displayName: string
  a_avatarUrl: string | null
  a_verified: number
}

function toRow(row: JoinedNotificationRow): NotificationRow {
  return {
    id: row.id,
    type: row.type,
    read: row.read,
    createdAt: row.createdAt,
    actor: {
      id: row.a_id,
      username: row.a_username,
      displayName: row.a_displayName,
      avatarUrl: row.a_avatarUrl,
      verified: row.a_verified,
    },
    post:
      row.postId && row.post_content !== null
        ? { id: row.postId, content: row.post_content }
        : null,
  }
}

const NOTIFICATION_SELECT = `
  SELECT n.id, n.type, n.read, n.createdAt, n.postId,
         p.content     AS post_content,
         u.id          AS a_id,
         u.username    AS a_username,
         u.displayName AS a_displayName,
         u.avatarUrl   AS a_avatarUrl,
         u.verified    AS a_verified
    FROM Notification n
    JOIN User u ON u.id = n.actorId
    LEFT JOIN Post p ON p.id = n.postId
`

/** Notifications for a user, newest first, keyset-paginated. */
export async function listNotifications(
  userId: string,
  options: { limit: number; cursor?: string | null },
): Promise<{ notifications: NotificationDTO[]; nextCursor: string | null }> {
  const clauses = ['n.userId = ?']
  const params: BindValue[] = [userId]
  if (options.cursor) {
    clauses.push('n.id < ?')
    params.push(options.cursor)
  }

  const rows = await all<JoinedNotificationRow>(
    `${NOTIFICATION_SELECT}
      WHERE ${clauses.join(' AND ')}
      ORDER BY n.id DESC
      LIMIT ?`,
    [...params, options.limit + 1],
  )

  const hasMore = rows.length > options.limit
  const page = hasMore ? rows.slice(0, options.limit) : rows
  return {
    notifications: page.map(toRow).map(buildNotificationDTO),
    nextCursor: hasMore ? (page[page.length - 1]?.id ?? null) : null,
  }
}

/** Unread badge count. Backed by the partial index on (userId) WHERE read = 0. */
export async function unreadNotificationCount(userId: string): Promise<number> {
  const row = await first<{ n: number }>(
    `SELECT COUNT(*) AS n FROM Notification WHERE userId = ? AND read = 0`,
    [userId],
  )
  return row?.n ?? 0
}

export interface CreateNotificationInput {
  userId: string
  actorId: string
  type: string
  postId?: string | null
}

export async function createNotification(input: CreateNotificationInput): Promise<void> {
  // Never notify yourself.
  if (input.userId === input.actorId) return
  await execute(
    `INSERT INTO Notification (id, userId, actorId, type, postId) VALUES (?, ?, ?, ?, ?)`,
    [
      newId(),
      input.userId,
      input.actorId,
      input.type,
      input.postId ?? null,
    ],
  )
}

/** Creates many notifications at once, e.g. for group-chat messages. */
export async function createNotifications(inputs: CreateNotificationInput[]): Promise<void> {
  if (inputs.length === 0) return
  // Insert one at a time: the batch endpoint shares a single transaction, and a
  // duplicate id (impossible here, ids are unique) would roll the batch back.
  for (const input of inputs) await createNotification(input)
}

/** Marks one notification read, enforcing ownership. */
export async function markNotificationRead(
  notificationId: string,
  userId: string,
): Promise<void> {
  const row = await first<{ id: string; userId: string }>(
    `SELECT id, userId FROM Notification WHERE id = ?`,
    [notificationId],
  )
  if (!row) throw notFoundError('Notifikasi tidak ditemukan')
  if (row.userId !== userId) throw notFoundError('Notifikasi tidak ditemukan')
  await execute(`UPDATE Notification SET read = 1 WHERE id = ?`, [notificationId])
}

/** Marks every notification for a user as read; returns how many changed. */
export async function markAllNotificationsRead(userId: string): Promise<number> {
  return execute(`UPDATE Notification SET read = 1 WHERE userId = ? AND read = 0`, [userId])
}

/** Deletes notifications that reference a set of posts (defensive cleanup). */
export async function deleteNotificationsForPosts(postIds: string[]): Promise<void> {
  if (postIds.length === 0) return
  for (const group of chunkIds(postIds)) {
    const where = inCondition('postId', group)
    if (!where) continue
    await execute(`DELETE FROM Notification WHERE ${where.sql}`, where.params)
  }
}

function chunkIds(ids: string[]): string[][] {
  const out: string[][] = []
  for (let i = 0; i < ids.length; i += 90) out.push(ids.slice(i, i + 90))
  return out
}

export type { AuthorRow }