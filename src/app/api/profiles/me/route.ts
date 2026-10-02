import { badRequestError, notFoundError, ok, parseJson, withErrorHandler } from '@/lib/api'
import { requireUser, validateUsername } from '@/lib/auth'
import {
  assertUsernameAvailable,
  loadProfiles,
  updateProfile,
  type UpdateProfileInput,
} from '@/lib/data/users'
import { optNullableText, optSafeUrl, optTrimmed } from '@/lib/validate'
import type { ProfileDTO } from '@/lib/types'

const HTTP_URL = /^https?:\/\/[^\s]+$/i

/** Reloads the signed-in user's profile with fresh aggregates. */
async function currentProfile(userId: string): Promise<ProfileDTO> {
  const [profile] = await loadProfiles([userId], userId)
  if (!profile) throw notFoundError('Profil tidak ditemukan')
  return profile
}

// GET /api/profiles/me — current user's profile (auth required)
//   → ProfileDTO
export const GET = withErrorHandler(async () => {
  const user = await requireUser()
  return ok(await currentProfile(user.id))
})

// PATCH /api/profiles/me — update current user profile
//   → ProfileDTO
//
// Every field is funnelled through `@/lib/validate`. The old handler guarded on
// `body.x !== undefined` and then called `.trim()` on the raw value, so
// `{"bio": null}` — or any number or object — threw a 500.
export const PATCH = withErrorHandler(async (req) => {
  const user = await requireUser()
  const body = await parseJson<Record<string, unknown>>(req)

  const updates: UpdateProfileInput = {}

  const displayName = optTrimmed(body.displayName, 'displayName')
  if (displayName !== undefined) {
    if (displayName.length > 50) throw badRequestError('Nama tampilan maksimal 50 karakter')
    updates.displayName = displayName
  }

  const username = optTrimmed(body.username, 'username')
  if (username !== undefined) {
    const usernameError = validateUsername(username)
    if (usernameError) throw badRequestError(usernameError)
    // Case-insensitive. The old check compared the raw `username` column, so a
    // user could claim `Alice` while `alice` already existed — a state that
    // `assertUsernameAvailable` (via `usernameLower`) can no longer produce.
    await assertUsernameAvailable(username, user.id)
    updates.username = username
  }

  const bio = optNullableText(body.bio, 'bio')
  if (bio !== undefined) {
    if (bio !== null && bio.length > 160) throw badRequestError('Bio maksimal 160 karakter')
    updates.bio = bio
  }

  const website = optNullableText(body.website, 'website')
  if (website !== undefined) {
    if (website !== null) {
      if (website.length > 200) throw badRequestError('Website URL terlalu panjang')
      if (!HTTP_URL.test(website)) {
        throw badRequestError('Website harus diawali http:// atau https://')
      }
    }
    updates.website = website
  }

  const location = optNullableText(body.location, 'location')
  if (location !== undefined) {
    if (location !== null && location.length > 60) throw badRequestError('Lokasi maksimal 60 karakter')
    updates.location = location
  }

  // `avatarUrl` / `coverUrl` are rendered into `<img src>`, so anything that is
  // not `http(s)://` or an app-relative `/uploads/...` path is rejected instead
  // of being persisted and later rendered as `javascript:` / `data:`.
  const avatarUrl = optSafeUrl(body.avatarUrl, 'avatarUrl')
  if (avatarUrl !== undefined) updates.avatarUrl = avatarUrl

  const coverUrl = optSafeUrl(body.coverUrl, 'coverUrl')
  if (coverUrl !== undefined) updates.coverUrl = coverUrl

  if (Object.keys(updates).length === 0) {
    throw badRequestError('Tidak ada perubahan untuk disimpan')
  }

  // One statement, so a partial update can never be persisted.
  await updateProfile(user.id, updates)

  return ok(await currentProfile(user.id))
})
