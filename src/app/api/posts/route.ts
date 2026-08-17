import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { ok, badRequest, unauthorized, withErrorHandler, parseJson } from '@/lib/api'
import { serializePost, POST_INCLUDE } from '@/lib/serialize'

// GET /api/posts?feed=home|explore|bookmarks&cursor=<id>&limit=20
export const GET = withErrorHandler(async (req: NextRequest) => {
  const user = await getCurrentUser()
  const { searchParams } = new URL(req.url)
  const feed = searchParams.get('feed') || 'home'
  const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50)
  const cursor = searchParams.get('cursor')

  // Bookmarks feed: posts the current user has saved
  if (feed === 'bookmarks') {
    if (!user) return unauthorized()
    const bookmarks = await db.bookmark.findMany({
      where: { userId: user.id },
      include: { post: { include: POST_INCLUDE } },
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    })
    const hasMore = bookmarks.length > limit
    const items = hasMore ? bookmarks.slice(0, limit) : bookmarks
    const serialized = await Promise.all(items.map((b) => serializePost(b.post, user.id)))
    return ok({ posts: serialized, nextCursor: hasMore ? items[items.length - 1].id : null })
  }

  let where: any = { replyToId: null }
  if (feed === 'home' && user) {
    const following = await db.follow.findMany({
      where: { followerId: user.id },
      select: { followingId: true },
    })
    const followingIds = following.map((f) => f.followingId)
    followingIds.push(user.id)
    where.authorId = { in: followingIds }
  }
  // explore = all posts (no follow filter)

  const posts = await db.post.findMany({
    where,
    include: POST_INCLUDE,
    orderBy: { createdAt: 'desc' },
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

// POST /api/posts — create post
export const POST = withErrorHandler(async (req: NextRequest) => {
  const user = await getCurrentUser()
  if (!user) return unauthorized()
  const body = await parseJson<{ content: string; media?: { url: string; type: string }[]; replyToId?: string | null; quotePostId?: string | null }>(req)

  const content = (body.content || '').trim()
  if (!content && (!body.media || body.media.length === 0)) return badRequest('Post tidak boleh kosong')
  if (content.length > 280) return badRequest('Post maksimal 280 karakter')

  const post = await db.post.create({
    data: {
      authorId: user.id,
      content,
      replyToId: body.replyToId || null,
      quotePostId: body.quotePostId || null,
      media: body.media?.length
        ? { create: body.media.map((m, i) => ({ url: m.url, type: m.type, order: i })) }
        : undefined,
    },
    include: POST_INCLUDE,
  })

  // If this is a reply, create notification for parent author
  if (body.replyToId) {
    const parent = await db.post.findUnique({ where: { id: body.replyToId }, select: { authorId: true } })
    if (parent && parent.authorId !== user.id) {
      await db.notification.create({
        data: { userId: parent.authorId, actorId: user.id, type: 'comment', postId: post.id },
      })
    }
  }

  const serialized = await serializePost(post, user.id)
  return ok({ post: serialized })
})
