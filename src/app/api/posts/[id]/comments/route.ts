import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { ok, withErrorHandler } from '@/lib/api'
import { serializePost, POST_INCLUDE } from '@/lib/serialize'

// GET /api/posts/[id]/comments — top-level replies to a post (cursor pagination)
// Replies = posts where replyToId === postId, ordered oldest-first (Twitter-like)
export const GET = withErrorHandler(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const user = await getCurrentUser()
  const { id } = await ctx.params
  const { searchParams } = new URL(req.url)
  const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50)
  const cursor = searchParams.get('cursor')

  const posts = await db.post.findMany({
    where: { replyToId: id },
    include: POST_INCLUDE,
    orderBy: { createdAt: 'asc' },
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  })

  const hasMore = posts.length > limit
  const items = hasMore ? posts.slice(0, limit) : posts
  const serialized = await Promise.all(items.map((p) => serializePost(p, user?.id)))

  return ok({
    posts: serialized,
    nextCursor: hasMore ? items[items.length - 1].id : null,
  })
})
