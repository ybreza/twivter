import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { ok, withErrorHandler } from '@/lib/api'
import {
  serializePost,
  serializeProfile,
  serializeCommunity,
  POST_INCLUDE,
  COMMUNITY_INCLUDE,
} from '@/lib/serialize'

// GET /api/search?q=...&type=posts|users|communities
// Returns matching posts/users/communities. Limit 20 per type.
export const GET = withErrorHandler(async (req: NextRequest) => {
  const user = await getCurrentUser()
  const { searchParams } = new URL(req.url)
  const q = (searchParams.get('q') || '').trim()
  const type = searchParams.get('type') // posts | users | communities | undefined (all)
  const limit = 20

  if (!q) {
    return ok({ posts: [], users: [], communities: [] })
  }

  const wantPosts = !type || type === 'posts'
  const wantUsers = !type || type === 'users'
  const wantCommunities = !type || type === 'communities'

  const [posts, users, communities] = await Promise.all([
    wantPosts
      ? db.post.findMany({
          where: {
            content: { contains: q },
            replyToId: null,
          },
          include: POST_INCLUDE,
          orderBy: { createdAt: 'desc' },
          take: limit,
        })
      : Promise.resolve([]),
    wantUsers
      ? db.user.findMany({
          where: {
            OR: [{ username: { contains: q } }, { displayName: { contains: q } }],
          },
          take: limit,
          orderBy: { createdAt: 'desc' },
        })
      : Promise.resolve([]),
    wantCommunities
      ? db.community.findMany({
          where: {
            OR: [{ name: { contains: q } }, { description: { contains: q } }],
          },
          include: COMMUNITY_INCLUDE,
          take: limit,
          orderBy: { createdAt: 'desc' },
        })
      : Promise.resolve([]),
  ])

  const [serializedPosts, serializedUsers, serializedCommunities] = await Promise.all([
    Promise.all(posts.map((p) => serializePost(p, user?.id))),
    Promise.all(users.map((u) => serializeProfile(u, user?.id))),
    Promise.all(communities.map((c) => serializeCommunity(c, user?.id))),
  ])

  return ok({
    posts: serializedPosts,
    users: serializedUsers,
    communities: serializedCommunities,
  })
})
