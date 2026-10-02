import { requireAdmin } from '@/lib/auth'
import { ok, withErrorHandler } from '@/lib/api'
import { getAdminStats } from '@/lib/data/moderation'

// GET /api/admin/stats — admin-only platform stats + 7-day growth.
//
// Every counter is aggregated in SQL. The previous implementation counted every
// row in `Post` as a "post" *and* again as a "comment", and pulled every user
// and post created in the window into memory on each dashboard load.
//
// Returns { users, posts, replies, likes, communities, conversations,
//           reports: { pending, resolved }, verifications: { pending },
//           growth: { date, users, posts }[] }
export const GET = withErrorHandler(async () => {
  await requireAdmin()
  return ok(await getAdminStats())
})