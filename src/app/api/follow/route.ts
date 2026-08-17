import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { requireUser } from '@/lib/auth'
import {
  ok,
  badRequest,
  notFound,
  conflict,
  withErrorHandler,
  parseJson,
} from '@/lib/api'

type FollowBody = { targetUserId?: string; username?: string }

// Resolve target user from either `targetUserId` or `username`
async function resolveTarget(body: FollowBody) {
  if (body.targetUserId) {
    return db.user.findUnique({ where: { id: body.targetUserId } })
  }
  if (body.username) {
    return db.user.findFirst({ where: { username: body.username } })
  }
  return null
}

// POST /api/follow — follow a user
export const POST = withErrorHandler(async (req: NextRequest) => {
  const me = await requireUser()
  const body = await parseJson<FollowBody>(req)
  const target = await resolveTarget(body)
  if (!target) return notFound('Pengguna tidak ditemukan')

  if (target.id === me.id) return badRequest('Tidak bisa follow diri sendiri')

  // Create follow (handle unique constraint — if exists, treat as already following)
  try {
    await db.follow.create({
      data: { followerId: me.id, followingId: target.id },
    })
    // Create notification for the target user
    await db.notification.create({
      data: { userId: target.id, actorId: me.id, type: 'follow' },
    })
  } catch (err: any) {
    if (err?.code === 'P2002') {
      // unique constraint — already following, that's fine
    } else {
      throw err
    }
  }

  const followersCount = await db.follow.count({
    where: { followingId: target.id },
  })

  return ok({ isFollowing: true, followersCount })
})

// DELETE /api/follow — unfollow a user
export const DELETE = withErrorHandler(async (req: NextRequest) => {
  const me = await requireUser()
  // body may be sent as JSON or as query string
  let body: FollowBody = {}
  const contentType = req.headers.get('content-type') || ''
  if (contentType.includes('application/json')) {
    body = await parseJson<FollowBody>(req)
  }
  // also accept query params as fallback
  const url = new URL(req.url)
  body.targetUserId = body.targetUserId ?? url.searchParams.get('targetUserId') ?? undefined
  body.username = body.username ?? url.searchParams.get('username') ?? undefined

  const target = await resolveTarget(body)
  if (!target) return notFound('Pengguna tidak ditemukan')

  await db.follow.deleteMany({
    where: { followerId: me.id, followingId: target.id },
  })

  const followersCount = await db.follow.count({
    where: { followingId: target.id },
  })

  return ok({ isFollowing: false, followersCount })
})
