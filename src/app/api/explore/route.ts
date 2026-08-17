import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { ok, withErrorHandler } from '@/lib/api'
import { serializePost, serializeProfile, POST_INCLUDE } from '@/lib/serialize'

// GET /api/explore — returns trending tags + suggested users + trending posts
export const GET = withErrorHandler(async (req: NextRequest) => {
  const user = await getCurrentUser()

  // ── Trending hashtags ──────────────────────
  // Scan last 1000 posts for #hashtags, count occurrences, return top 10.
  const recentPosts = await db.post.findMany({
    where: { createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
    select: { content: true },
    take: 1000,
    orderBy: { createdAt: 'desc' },
  })

  const tagCounts = new Map<string, number>()
  const hashtagRegex = /#([\p{L}\p{N}_]+)/gu
  for (const p of recentPosts) {
    const matches = p.content.matchAll(hashtagRegex)
    for (const m of matches) {
      const tag = m[1].toLowerCase()
      tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1)
    }
  }

  let trending = [...tagCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([tag, postsCount]) => ({ tag, postsCount }))

  // Synthesize fallback trends if none found
  if (trending.length === 0) {
    trending = [
      { tag: 'twivter', postsCount: 128 },
      { tag: 'teknologi', postsCount: 86 },
      { tag: 'startup', postsCount: 54 },
      { tag: 'ai', postsCount: 42 },
      { tag: 'programming', postsCount: 31 },
      { tag: 'olahraga', postsCount: 24 },
      { tag: 'kuliner', postsCount: 19 },
    ]
  }

  // ── Trending posts (top 5 by like count in last 24h) ───
  // NOTE: Prisma's `groupBy({ orderBy: { _count: { _all: 'desc' } } })` is not
  // supported on SQLite. We instead fetch recent posts + their likes and sort
  // in JS — fine for the demo dataset.
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
  const recentTopLevelPosts = await db.post.findMany({
    where: { createdAt: { gte: dayAgo }, replyToId: null },
    select: { id: true },
    take: 200,
    orderBy: { createdAt: 'desc' },
  })

  let trendingPosts: Awaited<ReturnType<typeof serializePost>>[] = []
  if (recentTopLevelPosts.length > 0) {
    const postIds = recentTopLevelPosts.map((p) => p.id)
    const likes = await db.like.findMany({
      where: { postId: { in: postIds } },
      select: { postId: true },
    })
    const counts = new Map<string, number>()
    for (const l of likes) {
      counts.set(l.postId, (counts.get(l.postId) ?? 0) + 1)
    }
    const topIds = [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([id]) => id)

    if (topIds.length > 0) {
      const posts = await db.post.findMany({
        where: { id: { in: topIds } },
        include: POST_INCLUDE,
      })
      const order = new Map(topIds.map((id, i) => [id, i]))
      posts.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0))
      trendingPosts = await Promise.all(posts.map((p) => serializePost(p, user?.id)))
    }
  }

  // Fallback: latest 5 posts if no trending posts found
  if (trendingPosts.length === 0) {
    const fallback = await db.post.findMany({
      where: { replyToId: null },
      include: POST_INCLUDE,
      orderBy: { createdAt: 'desc' },
      take: 5,
    })
    trendingPosts = await Promise.all(fallback.map((p) => serializePost(p, user?.id)))
  }

  // ── Suggested users (top 5 by follower count, exclude current user) ───
  // Again, `groupBy` with `_count._all` orderBy is unsupported on SQLite —
  // fetch follows for non-me/non-followed users and aggregate in JS.
  const followingIds = user
    ? (await db.follow.findMany({ where: { followerId: user.id }, select: { followingId: true } })).map(
        (f) => f.followingId
      )
    : []
  const excludeIds = [...followingIds, ...(user ? [user.id] : [])]

  const follows = await db.follow.findMany({
    where: { followingId: { notIn: excludeIds.length > 0 ? excludeIds : undefined } },
    select: { followingId: true },
    take: 1000,
  })
  const userFollowerCounts = new Map<string, number>()
  for (const f of follows) {
    userFollowerCounts.set(f.followingId, (userFollowerCounts.get(f.followingId) ?? 0) + 1)
  }
  const topUserIds = [...userFollowerCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([id]) => id)

  let suggestedUsers: Awaited<ReturnType<typeof serializeProfile>>[] = []
  if (topUserIds.length > 0) {
    const users = await db.user.findMany({
      where: { id: { in: topUserIds } },
    })
    const order = new Map(topUserIds.map((id, i) => [id, i]))
    users.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0))
    suggestedUsers = await Promise.all(users.map((u) => serializeProfile(u, user?.id)))
  } else {
    // fallback: any 5 users not me
    const fallback = await db.user.findMany({
      where: user ? { id: { not: user.id } } : {},
      take: 5,
      orderBy: { createdAt: 'asc' },
    })
    suggestedUsers = await Promise.all(fallback.map((u) => serializeProfile(u, user?.id)))
  }

  return ok({ trending, suggestedUsers, trendingPosts })
})
