import { ok, withErrorHandler } from '@/lib/api'
import { requireUser } from '@/lib/auth'
import { parseLimit } from '@/lib/db'
import { listNotifications, unreadNotificationCount } from '@/lib/data/notifications'

// GET /api/notifications?cursor=<id>&limit=30
//   → { notifications: NotificationDTO[], unreadCount: number, nextCursor: string | null }
// GET /api/notifications?unread=1
//   → { unreadCount: number }
//
// The repository LEFT JOINs `Post`, so a notification whose post was deleted now
// serialises with `post: null`. Previously the serializer dereferenced that
// post unconditionally and the whole feed returned 500 for that user forever.
export const GET = withErrorHandler(async (req) => {
  const user = await requireUser()
  const { searchParams } = new URL(req.url)

  if (searchParams.get('unread') === '1') {
    return ok({ unreadCount: await unreadNotificationCount(user.id) })
  }

  // `?limit=0` used to reach the ORM as `0 + 1` and `?limit=abc` as `NaN`.
  const limit = parseLimit(searchParams.get('limit'), 30, 50)
  const cursor = searchParams.get('cursor') || null

  const [{ notifications, nextCursor }, unreadCount] = await Promise.all([
    listNotifications(user.id, { limit, cursor }),
    unreadNotificationCount(user.id),
  ])

  return ok({ notifications, unreadCount, nextCursor })
})