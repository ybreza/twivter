import { ok, parseJson, withErrorHandler } from '@/lib/api'
import { requireUser } from '@/lib/auth'
import { markAllNotificationsRead, markNotificationRead } from '@/lib/data/notifications'
import { optTrimmed } from '@/lib/validate'

// POST /api/notifications/read
// Body: { id? } — with `id`, mark that one read; without it, mark all read.
// Returns { success: true }
//
// Ownership is enforced in the repository and both "no such notification" and
// "someone else's notification" are 404. The old handler answered 400 for the
// first and 400 with a different message for the second, which both leaked
// existence and told a legitimate owner their own id was malformed.
export const POST = withErrorHandler(async (req) => {
  const user = await requireUser()
  const body = await parseJson(req)

  // Coerced, never `.trim()`ed raw — `body.id` used to reach the ORM unchecked.
  const id = optTrimmed(body.id, 'id')
  if (id !== undefined) {
    await markNotificationRead(id, user.id)
  } else {
    await markAllNotificationsRead(user.id)
  }

  return ok({ success: true })
})