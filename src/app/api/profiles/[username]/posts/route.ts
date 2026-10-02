import { badRequestError, ok, withErrorHandler } from '@/lib/api'
import { getCurrentUser } from '@/lib/auth'
import { all, parseLimit, type BindValue } from '@/lib/db'
import { fetchPostPage, fetchPostsByIds } from '@/lib/data/posts'
import { requireUserByUsername } from '@/lib/data/users'
import type { PostDTO } from '@/lib/types'

const TABS = ['posts', 'replies', 'media', 'likes'] as const
type Tab = (typeof TABS)[number]

function pathParam(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? ''
}

/** Hydrates `quotePost`/`replyTo` one level deep, like the feed repository does. */
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
 * The "likes" tab: posts the profile owner has liked, newest like first.
 *
 * Paginated on the `Like` row's own id — the old handler used
 * `cursor: { id }` with `orderBy: { createdAt }`, which skipped and repeated
 * rows, then re-fetched the posts with an unordered `findMany`.
 */
async function fetchLikedPosts(
  ownerId: string,
  limit: number,
  cursor: string | null,
  currentUserId: string | null,
): Promise<{ posts: PostDTO[]; nextCursor: string | null }> {
  const rows = await all<{ id: string; postId: string }>(
    `SELECT id, postId
       FROM Like
      WHERE userId = ?${cursor ? ' AND id < ?' : ''}
      ORDER BY id DESC
      LIMIT ?`,
    [...(cursor ? [ownerId, cursor] : [ownerId]), limit + 1] as BindValue[],
  )

  const hasMore = rows.length > limit
  const page = hasMore ? rows.slice(0, limit) : rows
  if (page.length === 0) return { posts: [], nextCursor: null }

  const byId = await fetchPostsByIds(
    page.map((row) => row.postId),
    currentUserId,
  )
  const posts: PostDTO[] = []
  for (const row of page) {
    const post = byId.get(row.postId)
    if (post) posts.push(post)
  }
  await hydrateNested(posts, currentUserId)

  return { posts, nextCursor: hasMore ? (page[page.length - 1]?.id ?? null) : null }
}

// GET /api/profiles/[username]/posts?tab=posts|replies|media|likes&cursor=<id>&limit=20
export const GET = withErrorHandler(async (req, ctx) => {
  const username = pathParam((await ctx.params).username)
  const viewer = await getCurrentUser()
  const { searchParams } = new URL(req.url)

  const rawTab = searchParams.get('tab') || 'posts'
  if (!(TABS as readonly string[]).includes(rawTab)) throw badRequestError('Tab tidak valid')
  const tab = rawTab as Tab
  const limit = parseLimit(searchParams.get('limit'), 20, 50)
  const cursor = searchParams.get('cursor')

  // Case-insensitive lookup; throws 404 when the username is unknown.
  const profile = await requireUserByUsername(username)

  if (tab === 'likes') {
    return ok(await fetchLikedPosts(profile.id, limit, cursor, viewer?.id ?? null))
  }

  const where =
    tab === 'posts'
      ? 'p.authorId = ? AND p.replyToId IS NULL'
      : tab === 'replies'
        ? 'p.authorId = ? AND p.replyToId IS NOT NULL'
        : // media: has at least one PostMedia row
          'p.authorId = ? AND EXISTS (SELECT 1 FROM PostMedia m WHERE m.postId = p.id)'

  const page = await fetchPostPage({
    where,
    params: [profile.id],
    limit,
    cursor,
    order: 'desc',
    currentUserId: viewer?.id ?? null,
    nested: true,
  })

  return ok(page)
})