import { ok, parseJson, withErrorHandler } from '@/lib/api'
import { getCurrentUser, requireUser } from '@/lib/auth'
import { parseLimit } from '@/lib/db'
import { createCommunity, listCommunities } from '@/lib/data/communities'
import { optNullableText, optTrimmed, reqString } from '@/lib/validate'

// GET /api/communities?q=…&limit=50
// Returns { communities: CommunityDTO[] }
//
// Anonymous callers are allowed; `isMember`/`membersCount` are simply false/0
// for them. The search term is escaped by `likeTerm`, so `%` and `_` are matched
// literally instead of acting as wildcards.
export const GET = withErrorHandler(async (req) => {
  const user = await getCurrentUser()
  const { searchParams } = new URL(req.url)

  const communities = await listCommunities({
    query: optTrimmed(searchParams.get('q'), 'q'),
    limit: parseLimit(searchParams.get('limit'), 50, 50),
    currentUserId: user?.id ?? null,
  })

  return ok({ communities })
})

// POST /api/communities — create community
// Body: { name, description? }
// Returns 200 { community: CommunityDTO }
//
// The old handler allocated a slug with a check-then-insert loop: two concurrent
// creates of the same name both saw a free slug and the loser hit a raw unique
// violation. Slug allocation now sits behind a UNIQUE index in the repository,
// so there is nothing to retry here.
export const POST = withErrorHandler(async (req) => {
  const user = await requireUser()
  const body = await parseJson(req)

  // Coerced through the validator: `reqString` rejects a missing or non-string
  // name, and `optNullableText` turns `{ "description": 5 }` into `'5'` and
  // `{ "description": null }` into NULL. The old `body.description?.trim()`
  // only guarded `undefined`, so `{ "description": 5 }` was a 500.
  const name = reqString(body.name, 'name')
  const description = optNullableText(body.description, 'description') ?? null

  // Enforces the 3..50 character name and the 280 character description cap.
  const community = await createCommunity(user.id, name, description)

  return ok({ community })
})