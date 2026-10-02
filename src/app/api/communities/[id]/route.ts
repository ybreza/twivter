import { notFoundError, ok, parseJson, withErrorHandler } from '@/lib/api'
import { getCurrentUser, requireUser } from '@/lib/auth'
import {
  deleteCommunity,
  getCommunity,
  getCommunityDetail,
  updateCommunity,
} from '@/lib/data/communities'
import { optNullableText, optString } from '@/lib/validate'

// GET /api/communities/[id] — fetch a single community by id or slug.
// Returns { community: CommunityDTO, members: (AuthorDTO & { role })[] }
//
// The member list is ranked owner → admin → member. The old handler ranked
// `role === 'moderator'`, but the only roles that exist are `owner | admin |
// member`, so every admin sorted as an ordinary member.
//
// PATCH /api/communities/[id] — owner-only edit.
// Body: { name?, description? } (description: null / "" clears it)
// Returns { community: CommunityDTO }
//
// DELETE /api/communities/[id] — owner-only delete.
// Returns { success: true }
//
// Owners previously had no way out at all: they could not leave (correctly) and
// there was no route to edit or delete the community they owned.

/** `[id]` is either an opaque id or a slug; both resolve to a real community. */
async function resolveCommunity(idOrSlug: string, viewerId?: string) {
  return getCommunity(idOrSlug, viewerId ?? null)
}

export const GET = withErrorHandler(async (req, ctx) => {
  const user = await getCurrentUser()
  const params = await ctx.params
  const raw = params.id
  const idOrSlug = Array.isArray(raw) ? raw[0] : raw
  if (!idOrSlug) throw notFoundError('Komunitas tidak ditemukan')

  // Recent members, ranked by role, with their author fields.
  const { community, members } = await getCommunityDetail(idOrSlug, user?.id ?? null)
  return ok({ community, members })
})

export const PATCH = withErrorHandler(async (req, ctx) => {
  const user = await requireUser()
  const params = await ctx.params
  const raw = params.id
  const idOrSlug = Array.isArray(raw) ? raw[0] : raw
  if (!idOrSlug) throw notFoundError('Komunitas tidak ditemukan')

  const body = await parseJson(req)

  // Only keys actually present in the body are forwarded, so a PATCH of
  // `{ name }` never wipes the description.
  const input: { name?: string; description?: string | null } = {}

  // Coerced, not `.trim()`ed raw. A blank name is forwarded rather than dropped
  // so the repository's "minimal 3 karakter" rule produces a 400 instead of a
  // silent no-op.
  const name = optString(body.name, 'name')
  if (name !== undefined) input.name = name.trim()

  // `undefined` = leave alone, `null` = clear.
  const description = optNullableText(body.description, 'description')
  if (description !== undefined) input.description = description

  // Owner check, length rules and the write live in one place; a non-owner gets
  // 403 and a stranger 403 as well.
  const community = await updateCommunity(
    (await resolveCommunity(idOrSlug, user.id)).id,
    user.id,
    input,
  )

  return ok({ community })
})

export const DELETE = withErrorHandler(async (req, ctx) => {
  const user = await requireUser()
  const params = await ctx.params
  const raw = params.id
  const idOrSlug = Array.isArray(raw) ? raw[0] : raw
  if (!idOrSlug) throw notFoundError('Komunitas tidak ditemukan')

  await deleteCommunity((await resolveCommunity(idOrSlug, user.id)).id, user.id)

  return ok({ success: true })
})