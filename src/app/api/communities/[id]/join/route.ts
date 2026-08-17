import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { requireUser } from '@/lib/auth'
import { ok, badRequest, notFound, withErrorHandler } from '@/lib/api'

// POST /api/communities/[id]/join — join community
export const POST = withErrorHandler(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireUser()
  const { id } = await ctx.params

  const community = await db.community.findFirst({
    where: { OR: [{ id }, { slug: id }] },
    select: { id: true },
  })
  if (!community) return notFound('Komunitas tidak ditemukan')

  const existing = await db.communityMember.findUnique({
    where: { communityId_userId: { communityId: community.id, userId: user.id } },
  })
  if (!existing) {
    await db.communityMember.create({
      data: { communityId: community.id, userId: user.id, role: 'member' },
    })
  }

  const membersCount = await db.communityMember.count({
    where: { communityId: community.id },
  })

  return ok({ isMember: true, membersCount })
})

// DELETE /api/communities/[id]/join — leave community (owners cannot leave)
export const DELETE = withErrorHandler(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireUser()
  const { id } = await ctx.params

  const community = await db.community.findFirst({
    where: { OR: [{ id }, { slug: id }] },
    select: { id: true },
  })
  if (!community) return notFound('Komunitas tidak ditemukan')

  const membership = await db.communityMember.findUnique({
    where: { communityId_userId: { communityId: community.id, userId: user.id } },
  })
  if (!membership) {
    const membersCount = await db.communityMember.count({
      where: { communityId: community.id },
    })
    return ok({ isMember: false, membersCount })
  }
  if (membership.role === 'owner') {
    return badRequest('Pemilik komunitas tidak dapat keluar. Transfer kepemilikan terlebih dahulu.')
  }

  await db.communityMember.delete({
    where: { id: membership.id },
  })

  const membersCount = await db.communityMember.count({
    where: { communityId: community.id },
  })

  return ok({ isMember: false, membersCount })
})
