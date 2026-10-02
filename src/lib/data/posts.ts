/**
 * Post repository.
 *
 * All post reads funnel through here so that a page of posts costs a fixed
 * number of queries regardless of page size:
 *
 *   1. posts joined with their author
 *   2. media for every post on the page
 *   3. like/repost/bookmark/comment counts for the whole page (one UNION ALL)
 *   4-6. "did *I* like/bookmark/repost these?" lookups
 *
 * That replaces ~7 queries *per post* (≈140 per page) in the old implementation.
 */
import { all, execute, first, type BindValue } from '../db'
import { chunk, inCondition } from '../sql'
import {
  buildPostDTO,
  EMPTY_POST_AGGREGATES,
  type MediaRow,
  type PostAggregates,
  type PostRecord,
} from '../serialize'
import type { PostDTO } from '../types'

// ── Row shapes ───────────────────────────────────────────────────────────────

interface JoinedPostRow {
  id: string
  authorId: string
  content: string
  replyToId: string | null
  quotePostId: string | null
  createdAt: string
  a_username: string
  a_displayName: string
  a_avatarUrl: string | null
  a_verified: number
}

const POST_SELECT = `
  SELECT p.id, p.authorId, p.content, p.replyToId, p.quotePostId, p.createdAt,
         u.username     AS a_username,
         u.displayName  AS a_displayName,
         u.avatarUrl    AS a_avatarUrl,
         u.verified     AS a_verified
    FROM Post p
    JOIN User u ON u.id = p.authorId
`

function toRecord(row: JoinedPostRow): PostRecord {
  return {
    id: row.id,
    authorId: row.authorId,
    content: row.content,
    replyToId: row.replyToId,
    quotePostId: row.quotePostId,
    createdAt: row.createdAt,
    author: {
      id: row.authorId,
      username: row.a_username,
      displayName: row.a_displayName,
      avatarUrl: row.a_avatarUrl,
      verified: row.a_verified,
    },
    media: [],
  }
}

async function loadMedia(postIds: string[]): Promise<Map<string, MediaRow[]>> {
  const byPost = new Map<string, MediaRow[]>()
  if (postIds.length === 0) return byPost
  for (const group of chunk(postIds)) {
    const where = inCondition('postId', group)
    if (!where) continue
    const rows = await all<MediaRow>(
      `SELECT id, postId, url, type, ord
         FROM PostMedia
        WHERE ${where.sql}
        ORDER BY postId, ord`,
      where.params,
    )
    for (const row of rows) {
      const list = byPost.get(row.postId)
      if (list) list.push(row)
      else byPost.set(row.postId, [row])
    }
  }
  return byPost
}

/**
 * Resolves counts and viewer flags for many posts at once.
 *
 * `commentCount` counts replies, which are `Post` rows with `replyToId` set.
 * (The old schema also had an unused `Comment` table; mixing the two is what
 * produced the "comment count doesn't update" bug.)
 */
export async function loadPostAggregates(
  postIds: string[],
  currentUserId?: string | null,
): Promise<Map<string, PostAggregates>> {
  const result = new Map<string, PostAggregates>()
  if (postIds.length === 0) return result
  for (const id of postIds) result.set(id, { ...EMPTY_POST_AGGREGATES })

  // Counts: one statement, four aggregates.
  for (const group of chunk(postIds)) {
    // One condition per column: `inCondition` already renders the full
    // `col IN (…)` clause, so prefixing it again produced
    // `WHERE postId IN postId IN (?)` and a 500 on every feed request.
    const onPost = inCondition('postId', group)
    const onReply = inCondition('replyToId', group)
    if (!onPost || !onReply) continue
    const p = onPost.params
    const rows = await all<{ kind: string; ref: string; n: number }>(
      `SELECT 'like' AS kind, postId AS ref, COUNT(*) AS n
         FROM Like     WHERE ${onPost.sql} GROUP BY postId
       UNION ALL
       SELECT 'repost',    postId, COUNT(*) FROM Repost    WHERE ${onPost.sql} GROUP BY postId
       UNION ALL
       SELECT 'bookmark',  postId, COUNT(*) FROM Bookmark  WHERE ${onPost.sql} GROUP BY postId
       UNION ALL
       SELECT 'comment',   replyToId, COUNT(*) FROM Post    WHERE ${onReply.sql} GROUP BY replyToId`,
      [...p, ...p, ...p, ...onReply.params],
    )
    for (const row of rows) {
      const entry = result.get(row.ref)
      if (!entry) continue
      if (row.kind === 'like') entry.likeCount = row.n
      else if (row.kind === 'repost') entry.repostCount = row.n
      else if (row.kind === 'bookmark') entry.bookmarkCount = row.n
      else if (row.kind === 'comment') entry.commentCount = row.n
    }
  }

  if (currentUserId) {
    const [liked, bookmarked, reposted] = await Promise.all([
      loadFlagged('Like', currentUserId, postIds),
      loadFlagged('Bookmark', currentUserId, postIds),
      loadFlagged('Repost', currentUserId, postIds),
    ])
    for (const id of liked) mark(result, id, 'liked')
    for (const id of bookmarked) mark(result, id, 'bookmarked')
    for (const id of reposted) mark(result, id, 'reposted')
  }

  return result
}

type FlagKey = 'liked' | 'bookmarked' | 'reposted'

function mark(map: Map<string, PostAggregates>, id: string, key: FlagKey): void {
  const entry = map.get(id)
  if (entry) entry[key] = true
}

async function loadFlagged(
  table: 'Like' | 'Bookmark' | 'Repost',
  userId: string,
  postIds: string[],
): Promise<string[]> {
  const out: string[] = []
  for (const group of chunk(postIds)) {
    const where = inCondition('postId', group)
    if (!where) continue
    const rows = await all<{ postId: string }>(
      `SELECT postId FROM ${table} WHERE userId = ? AND ${where.sql}`,
      [userId, ...where.params],
    )
    out.push(...rows.map((r) => r.postId))
  }
  return out
}

// ── Public reads ─────────────────────────────────────────────────────────────

export interface PostPageOptions {
  /** Boolean SQL expression, without the `WHERE` keyword. */
  where?: string
  params?: BindValue[]
  /** Sort direction on the id keyset. */
  order?: 'desc' | 'asc'
  /** Rows to return (the repository fetches one extra to detect `hasMore`). */
  limit: number
  cursor?: string | null
  currentUserId?: string | null
  /** Hydrate quoted and parent posts (one level deep). */
  nested?: boolean
}

export interface PostPage {
  posts: PostDTO[]
  nextCursor: string | null
}

/** Loads a page of posts with counts, flags and optional nested posts. */
export async function fetchPostPage(options: PostPageOptions): Promise<PostPage> {
  const { where, params = [], order = 'desc', limit, cursor, currentUserId, nested = false } = options

  const clauses: string[] = []
  if (where) clauses.push(`(${where})`)
  if (cursor) clauses.push(order === 'desc' ? 'p.id < ?' : 'p.id > ?')
  const whereSql = clauses.length ? ` WHERE ${clauses.join(' AND ')}` : ''
  const bindParams: BindValue[] = [...params]
  if (cursor) bindParams.push(cursor)

  const rows = await all<JoinedPostRow>(
    `${POST_SELECT}${whereSql} ORDER BY p.id ${order.toUpperCase()} LIMIT ?`,
    [...bindParams, limit + 1],
  )

  const hasMore = rows.length > limit
  const pageRows = hasMore ? rows.slice(0, limit) : rows
  if (pageRows.length === 0) return { posts: [], nextCursor: null }

  const records = pageRows.map(toRecord)
  const postIds = records.map((r) => r.id)
  const [media, aggregates] = await Promise.all([
    loadMedia(postIds),
    loadPostAggregates(postIds, currentUserId),
  ])

  for (const record of records) {
    record.media = media.get(record.id) ?? []
  }

  const posts = records.map((record) =>
    buildPostDTO(record, aggregates.get(record.id) ?? EMPTY_POST_AGGREGATES),
  )

  if (nested) {
    const nestedIds = [
      ...new Set(records.flatMap((r) => [r.quotePostId, r.replyToId].filter(Boolean) as string[])),
    ]
    const nestedById = await fetchPostsByIds(nestedIds, currentUserId)
    for (let i = 0; i < records.length; i++) {
      const record = records[i]
      const dto = posts[i]
      if (record.quotePostId) dto.quotePost = nestedById.get(record.quotePostId) ?? null
      if (record.replyToId) dto.replyTo = nestedById.get(record.replyToId) ?? null
    }
  }

  return {
    posts,
    nextCursor: hasMore ? (pageRows[pageRows.length - 1]?.id ?? null) : null,
  }
}

/** Loads specific posts (already complete with counts and flags), keyed by id. */
export async function fetchPostsByIds(
  ids: string[],
  currentUserId?: string | null,
): Promise<Map<string, PostDTO>> {
  const out = new Map<string, PostDTO>()
  const unique = [...new Set(ids.filter(Boolean))]
  if (unique.length === 0) return out

  for (const group of chunk(unique)) {
    const where = inCondition('p.id', group)
    if (!where) continue
    const rows = await all<JoinedPostRow>(
      `${POST_SELECT} WHERE ${where.sql} ORDER BY p.id ASC`,
      where.params,
    )
    const records = rows.map(toRecord)
    const [media, aggregates] = await Promise.all([
      loadMedia(records.map((r) => r.id)),
      loadPostAggregates(records.map((r) => r.id), currentUserId),
    ])
    for (const record of records) {
      record.media = media.get(record.id) ?? []
      out.set(record.id, buildPostDTO(record, aggregates.get(record.id) ?? EMPTY_POST_AGGREGATES))
    }
  }
  return out
}

/** Loads a single post, or null when it does not exist. */
export async function fetchPostById(id: string, currentUserId?: string | null): Promise<PostDTO | null> {
  const map = await fetchPostsByIds([id], currentUserId)
  return map.get(id) ?? null
}

/** Lightweight existence check used before writes that reference a post. */
export async function postExists(id: string): Promise<boolean> {
  const row = await first<{ id: string }>(`SELECT id FROM Post WHERE id = ?`, [id])
  return row !== null
}

/** Deletes a post and everything hanging off it. */
export async function deletePostCascade(postId: string): Promise<void> {
  // Notifications, media, likes, bookmarks, reposts, replies and quotes all have
  // ON DELETE CASCADE, so a single statement removes the whole subtree.
  await execute(`DELETE FROM Post WHERE id = ?`, [postId])
}