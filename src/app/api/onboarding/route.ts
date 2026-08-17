import { db } from '@/lib/db'
import {
  getCurrentUser,
  validateUsername,
} from '@/lib/auth'
import {
  ok,
  badRequest,
  unauthorized,
  conflict,
  serverError,
  withErrorHandler,
  parseJson,
} from '@/lib/api'

export const POST = withErrorHandler(async (req: Request) => {
  const currentUser = await getCurrentUser()
  if (!currentUser) return unauthorized()

  const body = await parseJson<{
    username?: string
    displayName?: string
    bio?: string
    website?: string
    location?: string
    avatarUrl?: string
    interests?: string[]
    followUserIds?: string[]
  }>(req)

  const username = (body.username ?? '').trim()
  const displayName = (body.displayName ?? '').trim()
  const bio = (body.bio ?? '').trim()
  const website = (body.website ?? '').trim()
  const location = (body.location ?? '').trim()
  const avatarUrl = body.avatarUrl ?? null
  const interests = Array.isArray(body.interests) ? body.interests : []
  const followUserIds = Array.isArray(body.followUserIds) ? body.followUserIds : []

  // Validate
  const usernameErr = validateUsername(username)
  if (usernameErr) return badRequest(usernameErr)

  if (!displayName) {
    return badRequest('Nama tampilan wajib diisi')
  }
  if (displayName.length > 50) {
    return badRequest('Nama tampilan maksimal 50 karakter')
  }

  if (bio && bio.length > 160) {
    return badRequest('Bio maksimal 160 karakter')
  }

  if (website && website.length > 200) {
    return badRequest('Website URL terlalu panjang')
  }

  if (location && location.length > 100) {
    return badRequest('Lokasi maksimal 100 karakter')
  }

  if (interests.length > 10) {
    return badRequest('Maksimal 10 minat')
  }

  // Validate followUserIds — must exist, not be self
  const sanitizedFollowIds = Array.from(new Set(followUserIds)).filter(
    (id) => id && id !== currentUser.id
  )
  if (sanitizedFollowIds.length > 0) {
    const validUsers = await db.user.findMany({
      where: { id: { in: sanitizedFollowIds } },
      select: { id: true },
    })
    const validIds = new Set(validUsers.map((u) => u.id))
    sanitizedFollowIds.length = 0
    sanitizedFollowIds.push(...Array.from(validIds))
  }

  // Check username uniqueness (exclude self, case-insensitive via raw SQL — SQLite)
  const conflicts = await db.$queryRaw<{ id: string }[]>`
    SELECT id FROM User
    WHERE LOWER(username) = LOWER(${username})
      AND id != ${currentUser.id}
    LIMIT 1
  `
  if (conflicts.length > 0) {
    return conflict('Username sudah digunakan')
  }

  try {
    const updated = await db.user.update({
      where: { id: currentUser.id },
      data: {
        username,
        displayName,
        bio: bio || null,
        website: website || null,
        location: location || null,
        avatarUrl: avatarUrl ?? undefined,
        interests: JSON.stringify(interests),
        onboarded: true,
      },
    })

    // Create follow relationships (skip duplicates silently)
    if (sanitizedFollowIds.length > 0) {
      const existing = await db.follow.findMany({
        where: {
          followerId: currentUser.id,
          followingId: { in: sanitizedFollowIds },
        },
        select: { followingId: true },
      })
      const existingSet = new Set(existing.map((f) => f.followingId))
      const toCreate = sanitizedFollowIds
        .filter((id) => !existingSet.has(id))
        .map((followingId) => ({
          followerId: currentUser.id,
          followingId,
        }))

      if (toCreate.length > 0) {
        // SQLite doesn't support `skipDuplicates` on createMany,
        // but we've already filtered existing follows above.
        await db.follow.createMany({ data: toCreate })

        // Create follow notifications for each new follow
        await db.notification.createMany({
          data: toCreate.map((f) => ({
            userId: f.followingId,
            actorId: currentUser.id,
            type: 'follow',
          })),
        })
      }
    }

    // Re-fetch full CurrentUser shape (consistent with /api/auth/me)
    const fresh = await getCurrentUser()
    return ok({ user: fresh })
  } catch (err: any) {
    if (err?.code === 'P2002') {
      return conflict('Username sudah digunakan')
    }
    return serverError('Gagal menyimpan onboarding', err?.message)
  }
})
