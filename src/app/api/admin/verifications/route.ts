import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'
import { ok, withErrorHandler } from '@/lib/api'
import { serializeProfile } from '@/lib/serialize'

interface VerificationDTO {
  id: string
  user: Awaited<ReturnType<typeof serializeProfile>>
  reason: string
  status: string
  createdAt: string
}

// GET /api/admin/verifications?status=pending|approved|rejected&cursor=<id>
// Returns { requests: VerificationDTO[], nextCursor: string | null }
//
// Note: the Verification model in our Prisma schema stores `userId` as a
// plain string (no @relation), so we can't `include: { user: true }`. We
// fetch the user rows separately and join in JS.
export const GET = withErrorHandler(async (req: NextRequest) => {
  const admin = await requireAdmin()
  const { searchParams } = new URL(req.url)
  const statusParam = searchParams.get('status') // null = all
  const cursor = searchParams.get('cursor')
  const limit = 50

  const validStatuses = ['pending', 'approved', 'rejected']
  const where: any = statusParam && validStatuses.includes(statusParam)
    ? { status: statusParam }
    : undefined

  const requests = await db.verification.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  })

  const hasMore = requests.length > limit
  const items = hasMore ? requests.slice(0, limit) : requests

  // Fetch the related user rows in a single query
  const userIds = Array.from(new Set(items.map((v) => v.userId)))
  const users = userIds.length
    ? await db.user.findMany({ where: { id: { in: userIds } } })
    : []
  const userById = new Map(users.map((u) => [u.id, u]))

  const serialized: VerificationDTO[] = await Promise.all(
    items.map(async (v) => {
      const u = userById.get(v.userId)
      // Defensive: if the user row was deleted, skip
      const profile = u ? await serializeProfile(u, admin.id) : null
      return {
        id: v.id,
        user: profile as any,
        reason: v.reason,
        status: v.status,
        createdAt: v.createdAt instanceof Date ? v.createdAt.toISOString() : v.createdAt,
      }
    })
  )

  return ok({
    requests: serialized,
    nextCursor: hasMore ? items[items.length - 1].id : null,
  })
})
