import { notFoundError, ok, withErrorHandler } from '@/lib/api'
import { getCurrentUser } from '@/lib/auth'
import { findUserByUsername, loadProfiles } from '@/lib/data/users'

function pathParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? '' : value ?? ''
}

// GET /api/profiles/[username] — public profile lookup.
//   → ProfileDTO (the bare profile, which is what `profile-view` renders).
//
// The old handler tried an exact match first and, on a miss, fell back to a
// `contains` scan of at most 50 rows, so whether "Alice" resolved depended on
// which rows happened to fall inside that window. Lookups now go through the
// `usernameLower` index and are case-insensitive by construction.
export const GET = withErrorHandler(async (req, ctx) => {
  const username = pathParam((await ctx.params).username)
  const currentUser = await getCurrentUser()

  const user = await findUserByUsername(username)
  if (!user) throw notFoundError('Profil tidak ditemukan')

  const [profile] = await loadProfiles([user.id], currentUser?.id ?? null)
  if (!profile) throw notFoundError('Profil tidak ditemukan')

  return ok(profile)
})
