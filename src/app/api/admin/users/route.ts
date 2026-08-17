import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'
import { ok, withErrorHandler } from '@/lib/api'
import { serializeProfile } from '@/lib/serialize'

// GET /api/admin/users?q=&role=user|admin&cursor=<id>
// Returns { users: ProfileDTO[], nextCursor: string | null }
export const GET = withErrorHandler(async (req: NextRequest) => {
  const admin = await requireAdmin()
  const { searchParams } = new URL(req.url)
  const q = (searchParams.get('q') || '').trim()
  const role = searchParams.get('role') // null = all
  const cursor = searchParams.get('cursor')
  const limit = 50

  // SQLite doesn't support `mode: 'insensitive'`, so use a case-insensitive
  // substring match via `contains` with the default (case-sensitive) collation
  // PLUS a `LOWER()` raw fallback for case-insensitive matching. Prisma on
  // SQLite supports `contains` with no mode flag — to get case-insensitive we
  // match against both the original and a LOWERed variant via raw SQL when q is
  // present. For simplicity (and demo scale) we just fetch candidates and
  // filter in JS.

  const where: any = {}
  if (role === 'user' || role === 'admin') {
    where.role = role
  }

  // Fetch candidates (limited by cursor pagination) then filter by q in JS.
  // For typical demo scale (<200 users) this is more than fast enough.
  const users = await db.user.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: cursor ? limit + 1 : limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  })

  const qLower = q.toLowerCase()
  const filtered = q
    ? users.filter(
        (u) =>
          u.username.toLowerCase().includes(qLower) ||
          u.displayName.toLowerCase().includes(qLower) ||
          u.email.toLowerCase().includes(qLower)
      )
    : users

  const hasMore = filtered.length > limit
  const items = hasMore ? filtered.slice(0, limit) : filtered

  const serialized = await Promise.all(items.map((u) => serializeProfile(u, admin.id)))

  return ok({
    users: serialized,
    nextCursor: hasMore ? items[items.length - 1].id : null,
  })
})
