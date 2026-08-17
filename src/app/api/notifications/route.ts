import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { ok, unauthorized, withErrorHandler } from '@/lib/api'
import { serializeNotification } from '@/lib/serialize'

// GET /api/notifications — list notifications (paginated by cursor)
// GET /api/notifications?unread=1 — return only unread count
//
// NOTE: The Prisma schema currently defines `Notification.postId` as a plain
// String? (no relation). The shared `serializeNotification` helper expects
// `n.post` to be populated, so we fetch notifications first, batch-fetch the
// referenced posts, then merge them in before serializing.
export const GET = withErrorHandler(async (req: NextRequest) => {
  const user = await getCurrentUser()
  if (!user) return unauthorized()

  const { searchParams } = new URL(req.url)
  const onlyUnreadCount = searchParams.get('unread') === '1'

  const unreadCount = await db.notification.count({
    where: { userId: user.id, read: false },
  })

  if (onlyUnreadCount) {
    return ok({ unreadCount })
  }

  const limit = Math.min(parseInt(searchParams.get('limit') || '30'), 50)
  const cursor = searchParams.get('cursor')

  const notifications = await db.notification.findMany({
    where: { userId: user.id },
    include: {
      actor: {
        select: {
          id: true,
          username: true,
          displayName: true,
          avatarUrl: true,
          verified: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  })

  const hasMore = notifications.length > limit
  const items = hasMore ? notifications.slice(0, limit) : notifications

  // Batch-fetch posts referenced by postId
  const postIds = Array.from(
    new Set(items.map((n) => n.postId).filter((p): p is string => !!p))
  )
  const posts = postIds.length > 0
    ? await db.post.findMany({
        where: { id: { in: postIds } },
        select: { id: true, content: true },
      })
    : []
  const postMap = new Map(posts.map((p) => [p.id, p]))

  // Attach `post` to each notification so serializeNotification works
  const withPosts = items.map((n) => ({
    ...n,
    post: n.postId ? postMap.get(n.postId) ?? null : null,
  }))

  const serialized = await Promise.all(withPosts.map((n) => serializeNotification(n)))

  return ok({
    notifications: serialized,
    unreadCount,
    nextCursor: hasMore ? items[items.length - 1].id : null,
  })
})
