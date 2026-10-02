import {
  badRequestError,
  notFoundError,
  ok,
  parseJson,
  unauthorizedError,
  withErrorHandler,
} from '@/lib/api'
import { followingIds, getCurrentUser, requireUser } from '@/lib/auth'
import { all, batch, first, parseLimit, type BindValue } from '@/lib/db'
import { fetchPostById, fetchPostPage, fetchPostsByIds, postExists } from '@/lib/data/posts'
import { createNotification } from '@/lib/data/notifications'
import { newId } from '@/lib/ids'
import { inCondition } from '@/lib/sql'
import { assertId, assertSafeUrl, maxLen, optTrimmed } from '@/lib/validate'
import type { PostDTO } from '@/lib/types'

const MAX_MEDIA = 4
const MAX_MEDIA_URL_LENGTH = 2000
const MEDIA_TYPES = ['image', 'video', 'gif'] as const
const POST_MAX_LENGTH = 280

interface MediaInput {
  url: string
  type: string
}

/**
 * Validates `body.media`.
 *
 * The old handler passed the array straight through to the database: there was
 * no cap, and a `javascript:` or `data:` URL was stored and later rendered into
 * an `<img src>`.
 */
function parseMedia(raw: unknown): MediaInput[] {
  if (raw === undefined || raw === null) return []
  if (!Array.isArray(raw)) throw badRequestError('Field "media" harus berupa array')
  if (raw.length > MAX_MEDIA) {
    throw badRequestError(`Maksimal ${MAX_MEDIA} media per post`)
  }

  return raw.map((item, index) => {
    const field = `media[${index}]`
    if (typeof item !== 'object' || item === null) {
      throw badRequestError(`Field "${field}" tidak valid`)
    }
    const source = item as Record<string, unknown>
    const url = maxLen(
      assertSafeUrl(source.url, `${field}.url`),
      MAX_MEDIA_URL_LENGTH,
      `${field}.url`,
    )
    const type = optTrimmed(source.type, `${field}.type`) ?? 'image'
    if (!(MEDIA_TYPES as readonly string[]).includes(type)) {
      throw badRequestError(`Field "${field}.type" harus salah satu dari: ${MEDIA_TYPES.join(', ')}`)
    }
    return { url, type }
  })
}

/** Reads an optional id field: absent/blank means null, anything else must be an id. */
function parseOptionalId(raw: unknown, field: string): string | null {
  const value = optTrimmed(raw, field)
  return value === undefined ? null : assertId(value, field)
}

/**
 * Hydrates `quotePost`/`replyTo` one level deep, like the feed repository does
 * for its own pages.
 */
async function hydrateNested(posts: PostDTO[], currentUserId: string | null): Promise<void> {
  const nestedIds = [
    ...new Set(posts.flatMap((p) => [p.quotePostId, p.replyToId].filter(Boolean) as string[])),
  ]
  if (nestedIds.length === 0) return
  const nested = await fetchPostsByIds(nestedIds, currentUserId)
  for (const post of posts) {
    if (post.quotePostId) post.quotePost = nested.get(post.quotePostId) ?? null
    if (post.replyToId) post.replyTo = nested.get(post.replyToId) ?? null
  }
}

/**
 * A per-user interaction feed (bookmarks here, likes on the profile page).
 *
 * Keyset on the interaction row's own id, which is time-sortable. The old query
 * combined `cursor: { id }` with `orderBy: { createdAt }`; `createdAt` is not
 * unique, so page 2 skipped or repeated rows.
 */
async function fetchInteractionPage(
  table: 'Bookmark' | 'Like',
  userId: string,
  limit: number,
  cursor: string | null,
  currentUserId: string | null,
): Promise<{ posts: PostDTO[]; nextCursor: string | null }> {
  const rows = await all<{ id: string; postId: string }>(
    `SELECT id, postId
       FROM ${table}
      WHERE userId = ?${cursor ? ' AND id < ?' : ''}
      ORDER BY id DESC
      LIMIT ?`,
    [...(cursor ? [userId, cursor] : [userId]), limit + 1] as BindValue[],
  )

  const hasMore = rows.length > limit
  const page = hasMore ? rows.slice(0, limit) : rows
  if (page.length === 0) return { posts: [], nextCursor: null }

  const byId = await fetchPostsByIds(
    page.map((row) => row.postId),
    currentUserId,
  )
  // Interaction rows cascade away with their post, but never hand back a hole.
  const posts: PostDTO[] = []
  for (const row of page) {
    const post = byId.get(row.postId)
    if (post) posts.push(post)
  }
  await hydrateNested(posts, currentUserId)

  return { posts, nextCursor: hasMore ? (page[page.length - 1]?.id ?? null) : null }
}

// GET /api/posts?feed=home|explore|bookmarks&cursor=<id>&limit=20
export const GET = withErrorHandler(async (req) => {
  const user = await getCurrentUser()
  const { searchParams } = new URL(req.url)
  const feed = searchParams.get('feed') || 'home'
  // `?limit=0` used to make `items[items.length - 1].id` throw, and `?limit=abc`
  // produced NaN.
  const limit = parseLimit(searchParams.get('limit'), 20, 50)
  const cursor = searchParams.get('cursor')

  // Bookmarks feed: posts the current user has saved.
  if (feed === 'bookmarks') {
    if (!user) throw unauthorizedError()
    return ok(await fetchInteractionPage('Bookmark', user.id, limit, cursor, user.id))
  }

  const clauses = ['p.replyToId IS NULL']
  const params: BindValue[] = []
  if (feed === 'home' && user) {
    const authorFilter = inCondition('p.authorId', [
      ...new Set([...(await followingIds(user.id)), user.id]),
    ])
    if (authorFilter) {
      // Parenthesised: `inCondition` ORs its chunks together, and SQL binds AND
      // tighter than OR, so an unbracketed filter would leak replies in as soon
      // as the follow list needed more than one chunk.
      clauses.push(`(${authorFilter.sql})`)
      params.push(...authorFilter.params)
    }
  }
  // explore = every root post, no follow filter (and the same for anonymous
  // visitors, who have no home feed).

  const page = await fetchPostPage({
    where: clauses.join(' AND '),
    params,
    limit,
    cursor,
    order: 'desc',
    currentUserId: user?.id ?? null,
    nested: true,
  })
  return ok(page)
})

// POST /api/posts — create post
export const POST = withErrorHandler(async (req) => {
  const user = await requireUser()
  const body = await parseJson(req)

  const content = optTrimmed(body.content, 'content') ?? ''
  const media = parseMedia(body.media)
  if (!content && media.length === 0) throw badRequestError('Post tidak boleh kosong')
  if (content.length > POST_MAX_LENGTH) {
    throw badRequestError(`Post maksimal ${POST_MAX_LENGTH} karakter`)
  }

  const replyToId = parseOptionalId(body.replyToId, 'replyToId')
  const quotePostId = parseOptionalId(body.quotePostId, 'quotePostId')

  // `replyToId`/`quotePostId` are real foreign keys now, so an unknown parent
  // used to surface as a 500 straight from the database. Resolve it first and
  // answer 404 instead — and grab the parent author for the notification.
  let parentAuthorId: string | null = null
  if (replyToId) {
    const parent = await first<{ id: string; authorId: string }>(
      `SELECT id, authorId FROM Post WHERE id = ?`,
      [replyToId],
    )
    if (!parent) throw notFoundError('Post yang dibalas tidak ditemukan')
    parentAuthorId = parent.authorId
  }
  if (quotePostId && !(await postExists(quotePostId))) {
    throw notFoundError('Post yang dikutip tidak ditemukan')
  }

  const postId = newId()
  const statements: { sql: string; params: BindValue[] }[] = [
    {
      sql: `INSERT INTO Post (id, authorId, content, replyToId, quotePostId)
            VALUES (?, ?, ?, ?, ?)`,
      params: [postId, user.id, content, replyToId, quotePostId],
    },
    ...media.map((item, index) => ({
      sql: `INSERT INTO PostMedia (id, postId, url, type, ord) VALUES (?, ?, ?, ?, ?)`,
      params: [newId(), postId, item.url, item.type, index],
    })),
  ]
  await batch(statements)

  // Notify the parent author. `postId` must be the *parent* post: the
  // notifications view navigates with it, and pointing at the new reply opened
  // the reply instead of the thread.
  if (parentAuthorId) {
    await createNotification({
      userId: parentAuthorId,
      actorId: user.id,
      type: 'comment',
      postId: replyToId,
    })
  }

  const post = await fetchPostById(postId, user.id)
  if (!post) throw notFoundError('Post tidak ditemukan')
  return ok({ post })
})