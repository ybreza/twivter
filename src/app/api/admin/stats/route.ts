import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'
import { ok, withErrorHandler } from '@/lib/api'

// GET /api/admin/stats — admin-only platform stats + 7-day growth
// Returns: { users, posts, comments, likes, communities, conversations,
//            reports: { pending, resolved }, verifications: { pending },
//            growth: { date, users, posts }[] }
export const GET = withErrorHandler(async () => {
  await requireAdmin()

  const [
    users,
    posts,
    comments,
    likes,
    communities,
    conversations,
    pendingReports,
    resolvedReports,
    pendingVerifications,
  ] = await Promise.all([
    db.user.count(),
    db.post.count(),
    db.post.count({ where: { replyToId: { not: null } } }),
    db.like.count(),
    db.community.count(),
    db.conversation.count(),
    db.report.count({ where: { status: 'pending' } }),
    db.report.count({ where: { status: 'resolved' } }),
    db.verification.count({ where: { status: 'pending' } }),
  ])

  // Build the 7-day window (UTC days, oldest → newest).
  const now = new Date()
  const todayUTC = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  )
  const buckets: { date: string; start: Date; end: Date; users: number; posts: number }[] = []
  for (let i = 6; i >= 0; i--) {
    const start = new Date(todayUTC)
    start.setUTCDate(todayUTC.getUTCDate() - i)
    const end = new Date(start)
    end.setUTCDate(start.getUTCDate() + 1)
    buckets.push({
      date: start.toISOString().slice(0, 10),
      start,
      end,
      users: 0,
      posts: 0,
    })
  }

  // Fetch all users + posts created in the last 7 days (a small set at demo scale)
  // and bucket them in JS by UTC date.
  const windowStart = buckets[0].start
  const [recentUsers, recentPosts] = await Promise.all([
    db.user.findMany({
      where: { createdAt: { gte: windowStart } },
      select: { createdAt: true },
    }),
    db.post.findMany({
      where: { createdAt: { gte: windowStart } },
      select: { createdAt: true },
    }),
  ])

  const bucketOf = (d: Date) =>
    buckets.find((b) => d >= b.start && d < b.end)

  for (const u of recentUsers) {
    const b = bucketOf(u.createdAt)
    if (b) b.users += 1
  }
  for (const p of recentPosts) {
    const b = bucketOf(p.createdAt)
    if (b) b.posts += 1
  }

  const growth = buckets.map((b) => ({
    date: b.date,
    users: b.users,
    posts: b.posts,
  }))

  return ok({
    users,
    posts,
    comments,
    likes,
    communities,
    conversations,
    reports: { pending: pendingReports, resolved: resolvedReports },
    verifications: { pending: pendingVerifications },
    growth,
  })
})
