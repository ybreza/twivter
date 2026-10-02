import { badRequestError, notFoundError, ok, withErrorHandler } from '@/lib/api'
import { requireUser } from '@/lib/auth'
import { getCommunity, joinCommunity, leaveCommunity } from '@/lib/data/communities'

// POST /api/communities/[id]/join — join community (idempotent)
// Returns { isMember: true, membersCount: number }
//
// The old handler was check-then-create with no database guarantee, so two
// simultaneous taps raced into a unique violation and a 500. The join is now a
// single `INSERT OR IGNORE` against a UNIQUE index, which cannot fail that way.
//
// DELETE /api/communities/[id]/join — leave community (owners cannot leave)
// Returns { isMember: false, membersCount: number }
export const POST = withErrorHandler(async (req, ctx) => {
  const user = await requireUser()
  const params = await ctx.params
  const raw = params.id
  const idOrSlug = Array.isArray(raw) ? raw[0] : raw
  if (!idOrSlug) throw notFoundError('Komunitas tidak ditemukan')

  // The repository mutates by id, so a slug has to be resolved first. Throws
  // 404 for an unknown community or slug.
  const community = await getCommunity(idOrSlug, user.id)

  const result = await joinCommunity(community.id, user.id)
  return ok(result)
})

export const DELETE = withErrorHandler(async (req, ctx) => {
  const user = await requireUser()
  const params = await ctx.params
  const raw = params.id
  const idOrSlug = Array.isArray(raw) ? raw[0] : raw
  if (!idOrSlug) throw notFoundError('Komunitas tidak ditemukan')

  const community = await getCommunity(idOrSlug, user.id)

  // Already not a member: idempotent, matching the old handler which returned
  // `{ isMember: false }` instead of erroring.
  if (!community.isMember) {
    return ok({ isMember: false, membersCount: community.membersCount })
  }
  if (community.role === 'owner') {
    throw badRequestError('Pemilik komunitas tidak dapat keluar. Transfer kepemilikan terlebih dahulu.')
  }

  const result = await leaveCommunity(community.id, user.id)
  return ok(result)
})