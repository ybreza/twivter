import { ok, withErrorHandler } from '@/lib/api'
import { getCurrentUser } from '@/lib/auth'
import { all } from '@/lib/db'
import { fetchPostsByIds } from '@/lib/data/posts'
import { suggestUsers } from '@/lib/data/users'
import type { PostDTO } from '@/lib/types'

// ── Bounds ────────────────────────────────────────────────────────────────────
// The old handler scanned 1000 rows for hashtags, materialised every `Like` row
// for the 200 newest posts, and then aggregated 1000 follows — all unbounded
// from the outside and none of them cached.
const TAG_WINDOW_MS = 7 * 24 * 60 * 60 * 1000
const TAG_SCAN_LIMIT = 300
const TAG_LIMIT = 10
const TAG_CACHE_TTL_MS = 60_000

const POST_WINDOW_MS = 24 * 60 * 60 * 1000
const TRENDING_POST_LIMIT = 5
const SUGGESTED_USER_LIMIT = 5

export interface TrendingTag {
  tag: string
  postsCount: number
}

const FALLBACK_TRENDS: TrendingTag[] = [
  { tag: 'twivter', postsCount: 128 },
  { tag: 'teknologi', postsCount: 86 },
  { tag: 'startup', postsCount: 54 },
  { tag: 'ai', postsCount: 42 },
  { tag: 'programming', postsCount: 31 },
  { tag: 'olahraga', postsCount: 24 },
  { tag: 'kuliner', postsCount: 19 },
]

// Hashtags change slowly and cost a table scan, so the result is memoised for a
// minute per isolate instead of being recomputed on every request.
let tagCache: { value: TrendingTag[]; expiresAt: number } | null = null

async function trendingTags(): Promise<TrendingTag[]> {
  if (tagCache && tagCache.expiresAt > Date.now()) return tagCache.value

  const since = new Date(Date.now() - TAG_WINDOW_MS).toISOString()
  // `LIKE '%#%'` lets SQLite skip posts that cannot contain a tag at all.
  const rows = await all<{ content: string }>(
    `SELECT content
       FROM Post
      WHERE createdAt >= ? AND content LIKE '%#%'
      ORDER BY id DESC
      LIMIT ?`,
    [since, TAG_SCAN_LIMIT],
  )

  const counts = new Map<string, number>()
  const hashtag = /#([\p{L}\p{N}_]+)/gu
  for (const row of rows) {
    for (const match of row.content.matchAll(hashtag)) {
      const tag = match[1].toLowerCase()
      counts.set(tag, (counts.get(tag) ?? 0) + 1)
    }
  }

  const tags = [...counts.entries()]
    // Explicit tie-break so the list is stable across requests.
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, TAG_LIMIT)
    .map(([tag, postsCount]) => ({ tag, postsCount }))

  const value = tags.length > 0 ? tags : FALLBACK_TRENDS
  tagCache = { value, expiresAt: Date.now() + TAG_CACHE_TTL_MS }
  return value
}

async function trendingPosts(currentUserId: string | null): Promise<PostDTO[]> {
  const since = new Date(Date.now() - POST_WINDOW_MS).toISOString()

  // Counts come from a single JOIN aggregate over the window instead of loading
  // one row per `Like` into memory and counting in JS.
  const top = await all<{ id: string }>(
    `SELECT p.id
       FROM Post p
       JOIN Like l ON l.postId = p.id
      WHERE p.replyToId IS NULL AND p.createdAt >= ?
      GROUP BY p.id
      ORDER BY COUNT(l.id) DESC, p.id DESC
      LIMIT ?`,
    [since, TRENDING_POST_LIMIT],
  )

  let ids = top.map((row) => row.id)
  if (ids.length === 0) {
    // Fallback: the newest root posts.
    const latest = await all<{ id: string }>(
      `SELECT id FROM Post WHERE replyToId IS NULL ORDER BY id DESC LIMIT ?`,
      [TRENDING_POST_LIMIT],
    )
    ids = latest.map((row) => row.id)
  }
  if (ids.length === 0) return []

  const map = await fetchPostsByIds(ids, currentUserId)
  // Preserve the ranking produced above.
  return ids
    .map((id) => map.get(id))
    .filter((post): post is PostDTO => Boolean(post))
}

// GET /api/explore — trending tags + suggested users + trending posts
//   → { trending: { tag, postsCount }[], suggestedUsers: ProfileDTO[], trendingPosts: PostDTO[] }
export const GET = withErrorHandler(async () => {
  const user = await getCurrentUser()
  const currentUserId = user?.id ?? null

  const [trending, posts, suggestedUsers] = await Promise.all([
    trendingTags(),
    trendingPosts(currentUserId),
    suggestUsers(currentUserId, SUGGESTED_USER_LIMIT),
  ])

  return ok({ trending, suggestedUsers, trendingPosts: posts })
})
