import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { ok, notFound, badRequest, withErrorHandler } from '@/lib/api'
import { serializePost, POST_INCLUDE } from '@/lib/serialize'

// GET /api/profiles/[username]/posts?tab=posts|replies|media|likes&cursor=<id>&limit=20
export const GET = withErrorHandler(
  async (req: NextRequest, ctx: { params: Promise<{ username: string }> }) => {
    const { username } = await ctx.params
    const currentUser = await getCurrentUser()
    const { searchParams } = new URL(req.url)
    const tab = (searchParams.get('tab') || 'posts') as 'posts' | 'replies' | 'media' | 'likes'
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50)
    const cursor = searchParams.get('cursor') || undefined

    // Lookup target user (case-insensitive fallback)
    let user = await db.user.findFirst({ where: { username } })
    if (!user) {
      const lower = username.toLowerCase()
      const candidates = await db.user.findMany({
        where: { username: { contains: lower } },
        take: 50,
      })
      user = candidates.find((u) => u.username.toLowerCase() === lower) ?? null
    }
    if (!user) return notFound('Pengguna tidak ditemukan')

    // Build the where clause for each tab
    let where: any
    let include = POST_INCLUDE

    if (tab === 'posts') {
      where = { authorId: user.id, replyToId: null }
    } else if (tab === 'replies') {
      where = { authorId: user.id, replyToId: { not: null } }
    } else if (tab === 'media') {
      where = { authorId: user.id, media: { some: {} } }
    } else if (tab === 'likes') {
      // Posts the user has liked — join via Like table.
      const likes = await db.like.findMany({
        where: { userId: user.id },
        select: { id: true, postId: true },
        orderBy: { createdAt: 'desc' },
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        take: limit + 1,
      })
      const hasMore = likes.length > limit
      const items = hasMore ? likes.slice(0, limit) : likes
      const posts = await db.post.findMany({
        where: { id: { in: items.map((l) => l.postId) } },
        include: POST_INCLUDE,
      })
      // preserve like order
      const order = new Map(items.map((l, i) => [l.postId, i]))
      posts.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0))
      const serialized = await Promise.all(posts.map((p) => serializePost(p, currentUser?.id ?? null)))
      return ok({
        posts: serialized,
        nextCursor: hasMore ? items[items.length - 1].id : null,
      })
    } else {
      return badRequest('Tab tidak valid')
    }

    const posts = await db.post.findMany({
      where,
      include,
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    })

    const hasMore = posts.length > limit
    const items = hasMore ? posts.slice(0, limit) : posts
    const serialized = await Promise.all(items.map((p) => serializePost(p, currentUser?.id ?? null)))

    return ok({
      posts: serialized,
      nextCursor: hasMore ? items[items.length - 1].id : null,
    })
  }
)
