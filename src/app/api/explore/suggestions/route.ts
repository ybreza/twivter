import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { ok, withErrorHandler } from '@/lib/api'
import type { AuthorDTO } from '@/lib/types'

interface SuggestionDTO extends AuthorDTO {
  bio: string | null
  followersCount: number
  isFollowing: boolean
}

export const GET = withErrorHandler(async () => {
  const currentUser = await getCurrentUser()

  // Top 8 users by follower count, excluding the current user.
  // SQLite: compute counts via a separate query because groupBy ordering by _count
  // is supported, but to be safe we fetch candidates and count in JS for accuracy.
  const candidates = await db.user.findMany({
    where: currentUser
      ? { id: { not: currentUser.id }, onboarded: true }
      : { onboarded: true },
    select: {
      id: true,
      username: true,
      displayName: true,
      avatarUrl: true,
      verified: true,
      bio: true,
    },
    take: 50,
  })

  // Count followers for each candidate
  const withCounts = await Promise.all(
    candidates.map(async (u) => ({
      ...u,
      followersCount: await db.follow.count({ where: { followingId: u.id } }),
    }))
  )

  // Sort by followers desc, take top 8
  const sorted = withCounts
    .sort((a, b) => b.followersCount - a.followersCount)
    .slice(0, 8)

  // Compute isFollowing for current user
  let followingSet = new Set<string>()
  if (currentUser && sorted.length > 0) {
    const follows = await db.follow.findMany({
      where: {
        followerId: currentUser.id,
        followingId: { in: sorted.map((s) => s.id) },
      },
      select: { followingId: true },
    })
    followingSet = new Set(follows.map((f) => f.followingId))
  }

  const users: SuggestionDTO[] = sorted.map((u) => ({
    id: u.id,
    username: u.username,
    displayName: u.displayName,
    avatarUrl: u.avatarUrl,
    verified: u.verified,
    bio: u.bio,
    followersCount: u.followersCount,
    isFollowing: followingSet.has(u.id),
  }))

  return ok({ users })
})
