import { badRequestError, conflictError, isUniqueViolation, ok, parseJson, withErrorHandler } from '@/lib/api'
import { loadCurrentUser, requireUser, validateUsername } from '@/lib/auth'
import { all, execute, type BindValue } from '@/lib/db'
import { assertUsernameAvailable, followUser } from '@/lib/data/users'
import { createNotification } from '@/lib/data/notifications'
import { inCondition } from '@/lib/sql'
import { optIdArray, optNullableText, optSafeUrl, optStringArray, optTrimmed } from '@/lib/validate'
import { INTEREST_OPTIONS } from '@/lib/types'

const HTTP_URL = /^https?:\/\/[^\s]+$/i
const MAX_INTERESTS = 10
const MAX_RAW_INTERESTS = 50
// The wizard offers at most a handful of accounts to pick from; the old handler
// accepted an unbounded array and turned it into one giant `IN (...)`.
const MAX_FOLLOWS = 30

// POST /api/onboarding — one-shot profile setup
//   → { user: CurrentUser }
//
// Onboarding is a wizard that must run exactly once. The old handler never
// checked `onboarded`, so a completed user could re-POST at any time and
// overwrite their username, display name, bio and interests (and re-run the
// follow inserts).
export const POST = withErrorHandler(async (req) => {
  const me = await requireUser()
  if (me.onboarded) throw conflictError('Onboarding sudah diselesaikan')

  const body = await parseJson<Record<string, unknown>>(req)

  const username = optTrimmed(body.username, 'username') ?? ''
  const usernameError = validateUsername(username)
  if (usernameError) throw badRequestError(usernameError)

  const displayName = optTrimmed(body.displayName, 'displayName')
  if (!displayName) throw badRequestError('Nama tampilan wajib diisi')
  if (displayName.length > 50) throw badRequestError('Nama tampilan maksimal 50 karakter')

  const bio = optNullableText(body.bio, 'bio') ?? null
  if (bio !== null && bio.length > 160) throw badRequestError('Bio maksimal 160 karakter')

  const website = optNullableText(body.website, 'website') ?? null
  if (website !== null) {
    if (website.length > 200) throw badRequestError('Website URL terlalu panjang')
    if (!HTTP_URL.test(website)) {
      throw badRequestError('Website harus diawali http:// atau https://')
    }
  }

  const location = optNullableText(body.location, 'location') ?? null
  if (location !== null && location.length > 100) throw badRequestError('Lokasi maksimal 100 karakter')

  // Rendered into `<img src>`; `javascript:` and `data:` are rejected.
  // `undefined` (field omitted) leaves an existing avatar untouched.
  const avatarUrl = optSafeUrl(body.avatarUrl, 'avatarUrl')

  // Whitelist against INTEREST_OPTIONS, exactly like /api/profiles/me/interests.
  // The old handler stored the raw array, so the same wizard could persist
  // values the settings screen refuses to show.
  const allowedInterests = new Set<string>(INTEREST_OPTIONS)
  const rawInterests = optStringArray(body.interests, 'interests', MAX_RAW_INTERESTS) ?? []
  const interests = [...new Set(rawInterests.filter((interest) => allowedInterests.has(interest)))]
  if (interests.length > MAX_INTERESTS) throw badRequestError('Maksimal 10 minat')

  const requestedFollowIds = (optIdArray(body.followUserIds, 'followUserIds', MAX_FOLLOWS) ?? []).filter(
    (id) => id !== me.id,
  )

  // Checked before any write, comparing `usernameLower` so `Alice` can never be
  // claimed while `alice` exists.
  await assertUsernameAvailable(username, me.id)

  // Keep only ids that resolve to a real account.
  let followIds: string[] = []
  const requested = inCondition('id', requestedFollowIds)
  if (requested) {
    const rows = await all<{ id: string }>(
      `SELECT id FROM User WHERE ${requested.sql}`,
      requested.params,
    )
    followIds = rows.map((row) => row.id)
  }

  const columns: string[] = []
  const params: BindValue[] = []
  const set = (column: string, value: BindValue) => {
    columns.push(`${column} = ?`)
    params.push(value)
  }

  set('username', username)
  set('usernameLower', username.toLowerCase())
  set('displayName', displayName)
  set('bio', bio)
  set('website', website)
  set('location', location)
  if (avatarUrl !== undefined) set('avatarUrl', avatarUrl)
  set('interests', JSON.stringify(interests))
  set('onboarded', 1)
  set('updatedAt', new Date().toISOString())

  try {
    await execute(`UPDATE User SET ${columns.join(', ')} WHERE id = ?`, [...params, me.id])
  } catch (err) {
    // The only unique index on these columns is `usernameLower`, so a violation
    // here really is the username — the follow inserts below no longer share
    // this handler's error path at all.
    if (isUniqueViolation(err)) throw conflictError('Username sudah digunakan')
    throw err
  }

  // Follows are idempotent (`INSERT OR IGNORE`): only newly created edges
  // produce a notification, so a retried request cannot spam anyone.
  for (const followingId of followIds) {
    const { created } = await followUser(me.id, followingId)
    if (!created) continue
    try {
      await createNotification({ userId: followingId, actorId: me.id, type: 'follow' })
    } catch (err) {
      // Best-effort: the profile write has already succeeded.
      console.error('[onboarding] gagal membuat notifikasi follow', err)
    }
  }

  return ok({ user: await loadCurrentUser(me.id) })
})
