import { badRequestError, notFoundError, ok, parseJson, withErrorHandler } from '@/lib/api'
import { requireUser } from '@/lib/auth'
import { createNotification } from '@/lib/data/notifications'
import {
  findUserById,
  findUserByUsername,
  followersCount,
  followUser,
  unfollowUser,
} from '@/lib/data/users'
import type { ProfileRow } from '@/lib/serialize'
import { assertId, optString } from '@/lib/validate'

interface FollowTarget {
  targetUserId?: unknown
  username?: unknown
}

/**
 * Resolves the follow target from `targetUserId` or `username`.
 *
 * The username lookup goes through the `usernameLower` index. The old handler
 * compared the raw `username` column, so asking for `alice` while the row said
 * `Alice` answered 404 for a user that plainly exists.
 */
async function resolveTarget(input: FollowTarget): Promise<ProfileRow> {
  const rawId = optString(input.targetUserId, 'targetUserId')
  if (rawId !== undefined && rawId.trim() !== '') {
    const byId = await findUserById(assertId(rawId, 'targetUserId'))
    if (byId) return byId
    throw notFoundError('Pengguna tidak ditemukan')
  }

  const rawName = optString(input.username, 'username')
  if (rawName !== undefined && rawName.trim() !== '') {
    const byName = await findUserByUsername(rawName)
    if (byName) return byName
    throw notFoundError('Pengguna tidak ditemukan')
  }

  throw notFoundError('Pengguna tidak ditemukan')
}

// POST /api/follow — follow a user
//   → { isFollowing, followersCount }
export const POST = withErrorHandler(async (req) => {
  const me = await requireUser()
  const body = await parseJson<FollowTarget>(req)
  const target = await resolveTarget(body)

  if (target.id === me.id) throw badRequestError('Tidak bisa follow diri sendiri')

  // `INSERT OR IGNORE` against UNIQUE (followerId, followingId): following twice
  // is a no-op instead of the old `catch (P2002)` dance, and `created` tells us
  // whether a notification is warranted.
  const { created } = await followUser(me.id, target.id)
  if (created) {
    try {
      await createNotification({ userId: target.id, actorId: me.id, type: 'follow' })
    } catch (err) {
      // Best-effort: the follow edge is already stored and must not be undone.
      console.error('[follow] gagal membuat notifikasi', err)
    }
  }

  return ok({ isFollowing: true, followersCount: await followersCount(target.id) })
})

// DELETE /api/follow — unfollow a user
//   Target may arrive as a JSON body or as a query string.
//   → { isFollowing, followersCount }
export const DELETE = withErrorHandler(async (req) => {
  const me = await requireUser()

  const contentType = req.headers.get('content-type') ?? ''
  const body: FollowTarget = contentType.includes('application/json')
    ? await parseJson<FollowTarget>(req)
    : {}

  const { searchParams } = new URL(req.url)
  const target = await resolveTarget({
    targetUserId: body.targetUserId ?? searchParams.get('targetUserId'),
    username: body.username ?? searchParams.get('username'),
  })

  await unfollowUser(me.id, target.id)

  return ok({ isFollowing: false, followersCount: await followersCount(target.id) })
})
