import { ok, withErrorHandler } from '@/lib/api'
import { getCurrentUser } from '@/lib/auth'
import { suggestUsers } from '@/lib/data/users'

// GET /api/explore/suggestions
//   → { users: ProfileDTO[] }
//
// The old handler read 50 users with no `orderBy` — so the candidate set was an
// arbitrary slice of the table — and then ran one sequential `COUNT(*)` per
// candidate, i.e. 51 round-trips to build 8 rows. `suggestUsers` does the same
// job with three statements and explicit `ORDER BY COUNT(followerId) DESC,
// u.id DESC` ordering.
export const GET = withErrorHandler(async () => {
  const currentUser = await getCurrentUser()
  const users = await suggestUsers(currentUser?.id ?? null, 8)
  return ok({ users })
})
