import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { ok, notFound, withErrorHandler } from '@/lib/api'
import { serializeCommunity, toAuthor, COMMUNITY_INCLUDE } from '@/lib/serialize'

// GET /api/communities/[id] — fetch single community by id or slug
// The [id] param can be either a cuid or a slug.
// Returns: { community: CommunityDTO, members: AuthorDTO[] (recent 50) }
export const GET = withErrorHandler(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const user = await getCurrentUser()
  const { id } = await ctx.params

  const community = await db.community.findFirst({
    where: { OR: [{ id }, { slug: id }] },
    include: COMMUNITY_INCLUDE,
  })

  if (!community) return notFound('Komunitas tidak ditemukan')

  // Recent 50 members with author fields
  const memberships = await db.communityMember.findMany({
    where: { communityId: community.id },
    include: {
      user: {
        select: { id: true, username: true, displayName: true, avatarUrl: true, verified: true },
      },
    },
    orderBy: { joinedAt: 'desc' },
    take: 50,
  })
  const members = memberships
    .sort((a, b) => {
      // owner first, then moderators, then members; preserve joinedAt desc within group
      const rank = (r: string) => (r === 'owner' ? 0 : r === 'moderator' ? 1 : 2)
      const ra = rank(a.role), rb = rank(b.role)
      if (ra !== rb) return ra - rb
      return (b.joinedAt?.getTime?.() ?? 0) - (a.joinedAt?.getTime?.() ?? 0)
    })
    .map((m) => toAuthor(m.user))

  const serialized = await serializeCommunity(community, user?.id)
  return ok({ community: serialized, members })
})
