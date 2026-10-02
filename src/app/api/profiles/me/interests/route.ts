import { badRequestError, notFoundError, ok, parseJson, withErrorHandler } from '@/lib/api'
import { requireUser } from '@/lib/auth'
import { execute } from '@/lib/db'
import { loadProfiles } from '@/lib/data/users'
import { optStringArray } from '@/lib/validate'
import { INTEREST_OPTIONS } from '@/lib/types'

const MAX_INTERESTS = 10
// Hard ceiling on the raw array, applied before the whitelist filter, so an
// oversized payload cannot turn into thousands of `Set` insertions.
const MAX_RAW_INTERESTS = 50

// PATCH /api/profiles/me/interests
//   Body: { interests: string[] }
//   → ProfileDTO
//
// The array is stored as a JSON string on `User.interests` (the convention set
// by the onboarding route), which is also what `CurrentUser.interests` returns.
export const PATCH = withErrorHandler(async (req) => {
  const user = await requireUser()
  const body = await parseJson<Record<string, unknown>>(req)

  const raw = optStringArray(body.interests, 'interests', MAX_RAW_INTERESTS) ?? []
  const allowed = new Set<string>(INTEREST_OPTIONS)
  const cleaned = [...new Set(raw.filter((interest) => allowed.has(interest)))]
  if (cleaned.length > MAX_INTERESTS) throw badRequestError('Maksimal 10 minat')

  await execute(`UPDATE User SET interests = ?, updatedAt = ? WHERE id = ?`, [
    JSON.stringify(cleaned),
    new Date().toISOString(),
    user.id,
  ])

  const [profile] = await loadProfiles([user.id], user.id)
  if (!profile) throw notFoundError('Profil tidak ditemukan')
  return ok(profile)
})
