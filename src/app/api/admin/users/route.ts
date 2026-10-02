import { requireAdmin } from '@/lib/auth'
import { ok, withErrorHandler } from '@/lib/api'
import { parseLimit } from '@/lib/db'
import { searchUsers } from '@/lib/data/moderation'

// GET /api/admin/users?q=&role=user|admin&limit=&cursor=<id>
// Returns { users: ProfileDTO[], nextCursor: string | null }
//
// The search term is pushed into SQL. The old handler applied it in JavaScript
// *after* `take`, so a search only ever saw the first 51 users and `nextCursor`
// was effectively always null.
export const GET = withErrorHandler(async (req) => {
  await requireAdmin()
  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q')?.trim() || undefined
  const roleParam = searchParams.get('role')
  const role =
    roleParam === 'user' || roleParam === 'admin' ? roleParam : ('all' as const)

  const { users, nextCursor } = await searchUsers({
    query: q,
    role,
    limit: parseLimit(searchParams.get('limit'), 50, 100),
    cursor: searchParams.get('cursor'),
  })

  return ok({ users, nextCursor })
})