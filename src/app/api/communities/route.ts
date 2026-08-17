import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser, requireUser } from '@/lib/auth'
import { ok, badRequest, withErrorHandler, parseJson } from '@/lib/api'
import { serializeCommunity, COMMUNITY_INCLUDE } from '@/lib/serialize'
import { slugify } from '@/lib/utils'

// GET /api/communities?q=... — list communities (limit 50)
export const GET = withErrorHandler(async (req: NextRequest) => {
  const user = await getCurrentUser()
  const { searchParams } = new URL(req.url)
  const q = (searchParams.get('q') || '').trim()
  const limit = 50

  const communities = await db.community.findMany({
    where: q
      ? { OR: [{ name: { contains: q } }, { description: { contains: q } }] }
      : undefined,
    include: COMMUNITY_INCLUDE,
    orderBy: { createdAt: 'desc' },
    take: limit,
  })

  const serialized = await Promise.all(
    communities.map((c) => serializeCommunity(c, user?.id))
  )

  return ok({ communities: serialized })
})

// POST /api/communities — create community
// Body: { name, description? }
export const POST = withErrorHandler(async (req: NextRequest) => {
  const user = await requireUser()
  const body = await parseJson<{ name: string; description?: string }>(req)

  const name = (body.name || '').trim()
  if (!name) return badRequest('Nama komunitas wajib diisi')
  if (name.length < 3) return badRequest('Nama komunitas minimal 3 karakter')
  if (name.length > 60) return badRequest('Nama komunitas maksimal 60 karakter')

  const description = body.description?.trim() || null

  // Generate unique slug (append `-2`, `-3`, ... if taken)
  const baseSlug = slugify(name) || `community-${Date.now()}`
  let slug = baseSlug
  let suffix = 1
  while (await db.community.findUnique({ where: { slug } })) {
    suffix += 1
    slug = `${baseSlug}-${suffix}`
  }

  const community = await db.community.create({
    data: {
      name,
      slug,
      description,
      ownerId: user.id,
      members: {
        create: { userId: user.id, role: 'owner' },
      },
    },
    include: COMMUNITY_INCLUDE,
  })

  const serialized = await serializeCommunity(community, user.id)
  return ok({ community: serialized })
})
