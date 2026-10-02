import { badRequestError, ok, withErrorHandler } from '@/lib/api'
import { getCurrentUser } from '@/lib/auth'
import { all, parseLimit } from '@/lib/db'
import { listCommunities } from '@/lib/data/communities'
import { fetchPostPage } from '@/lib/data/posts'
import { loadProfiles } from '@/lib/data/users'
import { likeTerm, sortKey } from '@/lib/sql'
import type { CommunityDTO, PostDTO, ProfileDTO } from '@/lib/types'

const SEARCH_TYPES = ['posts', 'users', 'communities'] as const
type SearchType = (typeof SEARCH_TYPES)[number]

/** Root posts whose content matches the term, newest first. */
async function searchPosts(
  query: string,
  limit: number,
  currentUserId: string | null,
): Promise<PostDTO[]> {
  const page = await fetchPostPage({
    where: `p.replyToId IS NULL AND p.content LIKE ? ESCAPE '\\'`,
    params: [likeTerm(query)],
    limit,
    order: 'desc',
    currentUserId,
    nested: true,
  })
  return page.posts
}

/** Accounts matching username or display name, newest first. */
async function searchUsers(
  query: string,
  limit: number,
  currentUserId: string | null,
): Promise<ProfileDTO[]> {
  const term = likeTerm(query)
  const rows = await all<{ id: string }>(
    `SELECT id
       FROM User
      WHERE username LIKE ? ESCAPE '\\' OR displayName LIKE ? ESCAPE '\\'
      ORDER BY id DESC
      LIMIT ?`,
    [term, term, limit],
  )
  if (rows.length === 0) return []

  const profiles = await loadProfiles(
    rows.map((row) => row.id),
    currentUserId,
  )
  // `loadProfiles` has no ORDER BY, so restore the newest-first order here.
  const byId = new Map(profiles.map((profile) => [profile.id, profile]))
  const ordered: ProfileDTO[] = []
  for (const row of rows) {
    const profile = byId.get(row.id)
    if (profile) ordered.push(profile)
  }
  return ordered
}

// GET /api/search?q=...&type=posts|users|communities&limit=20
// Returns matching posts/users/communities. `type` omitted searches all three.
export const GET = withErrorHandler(async (req) => {
  const user = await getCurrentUser()
  const { searchParams } = new URL(req.url)

  // `sortKey` trims and caps the term, so a multi-kilobyte query string cannot
  // reach the LIKE pattern.
  const q = sortKey(searchParams.get('q') ?? '')
  // A blank `type` still means "all three", as it did before.
  const rawType = searchParams.get('type')?.trim() || null
  // An unrecognised type used to answer 200 with three empty arrays, which the
  // UI rendered as "no results" instead of an error.
  if (rawType !== null && !(SEARCH_TYPES as readonly string[]).includes(rawType)) {
    throw badRequestError(`type harus salah satu dari: ${SEARCH_TYPES.join(', ')}`)
  }
  const limit = parseLimit(searchParams.get('limit'), 20, 50)

  if (!q) return ok({ posts: [], users: [], communities: [] })

  const type: SearchType | null =
    rawType === null ? null : (rawType as SearchType)
  const currentUserId = user?.id ?? null

  const [posts, users, communities] = await Promise.all([
    type === null || type === 'posts'
      ? searchPosts(q, limit, currentUserId)
      : Promise.resolve<PostDTO[]>([]),
    type === null || type === 'users'
      ? searchUsers(q, limit, currentUserId)
      : Promise.resolve<ProfileDTO[]>([]),
    type === null || type === 'communities'
      ? listCommunities({ query: q, limit, currentUserId })
      : Promise.resolve<CommunityDTO[]>([]),
  ])

  return ok({ posts, users, communities })
})