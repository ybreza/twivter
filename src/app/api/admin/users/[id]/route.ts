import { requireAdmin } from '@/lib/auth'
import { badRequestError, notFoundError, ok, parseJson, withErrorHandler } from '@/lib/api'
import { optBool, optTrimmed } from '@/lib/validate'
import { loadProfiles } from '@/lib/data/users'
import { setUserRole, setUserVerified } from '@/lib/data/moderation'

// PATCH /api/admin/users/[id]
// Body: { role?: 'user'|'admin', verified?: boolean }
// Returns the updated ProfileDTO directly (this route is not nested under a key).
export const PATCH = withErrorHandler(async (req, ctx) => {
  const admin = await requireAdmin()
  const raw = await ctx.params
  const id = Array.isArray(raw.id) ? raw.id[0] : raw.id
  if (!id) throw notFoundError('Pengguna tidak ditemukan')

  const body = await parseJson(req)
  const role = optTrimmed(body.role, 'role')
  const verified = optBool(body.verified, 'verified')

  if (role === undefined && verified === undefined) {
    throw badRequestError('Tidak ada perubahan untuk disimpan')
  }
  if (role !== undefined && role !== 'user' && role !== 'admin') {
    throw badRequestError('role harus salah satu dari: user, admin')
  }

  // Both helpers throw 404 when the target does not exist, and `setUserRole`
  // refuses to let an admin demote themselves.
  if (role !== undefined) await setUserRole(admin.id, id, role)
  if (verified !== undefined) await setUserVerified(admin.id, id, verified)

  // Re-read through the shared loader so the response always carries fresh
  // counts and flags.
  const [profile] = await loadProfiles([id])
  if (!profile) throw notFoundError('Pengguna tidak ditemukan')

  return ok(profile)
})