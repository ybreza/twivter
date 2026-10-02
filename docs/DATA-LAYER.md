# Twivter data-layer contract (Cloudflare D1)

Read this fully before writing any route. Prisma has been removed; every route
must use the helpers below.

## Core helpers — `@/lib/db`

```ts
all<T>(sql, params?)        // Promise<T[]>          SELECT rows
first<T>(sql, params?)      // Promise<T | null>     first row
scalar<T>(sql, params?)     // Promise<T>            first column of first row
execute(sql, params?)       // Promise<number>       rows changed
batch([{sql, params}])      // Promise<void>          one atomic round-trip
type BindValue = string | number | null | ArrayBuffer | Uint8Array
```

Never build SQL by string-concatenating user input. Use `?` placeholders plus the
helpers in `@/lib/sql`: `placeholders(n)`, `chunk(list)`, `inCondition(col, ids)`
(returns `{ sql, params } | null`), `likeTerm(raw)` (escapes `%` and `_`),
`eqAll({ col: value })`.

## Errors — `@/lib/api`

Never return an error response manually from a handler that can fail; **throw**.

```ts
throw badRequestError('message')   // 400
throw unauthorizedError()          // 401
throw forbiddenError()             // 403
throw notFoundError('message')     // 404
throw conflictError('message')     // 409
```

`withErrorHandler` maps these, maps `ZodError` → 400, malformed JSON → 400,
unique-constraint violations → 409, and everything else → a generic 500 that does
**not** leak internal messages. Success: `ok(data)`, `created(data)`.

## Body validation — `@/lib/validate`

Never call `.trim()` on a raw body field. Coerce first:

```ts
reqString(body.x, 'x')            // required string, 400 if missing
optString(body.x, 'x')            // string | undefined
optTrimmed(body.x, 'x')           // trimmed string | undefined (blank => undefined)
optNullableText(body.x, 'x')      // string | null | undefined (blank => null)
optBool / optInt / optStringArray / optIdArray
assertId(body.id, 'id')           // validated opaque id
assertSafeUrl(body.url, 'url')    // http(s):// or /uploads/... — rejects javascript:/data:
optSafeUrl(body.url, 'url')
maxLen(value, 60, 'field')
```

All page/route handlers are wrapped in `withErrorHandler`, so these throws
become correct status codes automatically.

## Auth — `@/lib/auth`

```ts
getCurrentUser(): Promise<CurrentUser | null>
requireUser():    Promise<CurrentUser>          // throws 401
requireAdmin():   Promise<CurrentUser>          // throws 403
loadCurrentUser(id): Promise<CurrentUser | null>
createSession(userId): Promise<string>
destroySession(token): Promise<void>
setSessionCookie(token) / clearSessionCookie()
followingIds(userId): Promise<string[]>
validateUsername / validateEmail / validatePassword  -> string | null
```

## Pagination — `@/lib/db` + `@/lib/data/posts`

Use `parseLimit(raw, fallback, max)` from `@/lib/db`. **Never** `parseInt` a limit
without clamping: `?limit=0` used to crash these routes.

Cursor pagination is a keyset on the sortable `id` column, always newest-first
unless the endpoint documents otherwise:

```ts
const page = await fetchPostPage({
  where: 'p.replyToId IS NULL AND p.authorId IN (...)',   // optional
  params: [...],
  limit,
  cursor,             // last id from the previous page
  order: 'desc',      // 'asc' for comment threads
  currentUserId: user?.id,
  nested: true,       // hydrate quotePost / replyTo one level deep
})
// -> { posts: PostDTO[], nextCursor: string | null }
```

## Repositories

`@/lib/data/posts`
```ts
fetchPostPage(opts)                      -> { posts: PostDTO[]; nextCursor }
fetchPostById(id, currentUserId?)        -> PostDTO | null
fetchPostsByIds(ids, currentUserId?)    -> Map<string, PostDTO>
loadPostAggregates(ids, currentUserId?)  -> Map<string, PostAggregates>
postExists(id)                           -> boolean
deletePostCascade(id)                    -> Promise<void>
```

`@/lib/data/users`
```ts
findUserById(id) / findUserByUsername(name)      -> ProfileRow | null   (case-insensitive)
requireUserById / requireUserByUsername           -> ProfileRow          (throws 404)
usernameAvailability(name, selfId?)               -> { available, reason }
createUser({ email, passwordHash, username, displayName }) -> id   (throws 409)
assertUsernameAvailable(name, selfId?)
updateProfile(userId, { displayName?, username?, bio?, website?, location?, avatarUrl?, coverUrl? })
loadProfile(username, currentUserId?)             -> ProfileDTO
loadProfiles(ids, currentUserId?)                 -> ProfileDTO[]
loadProfileAggregates(ids, currentUserId?)
followUser(a, b)          -> { isFollowing, created }
unfollowUser(a, b)        -> { isFollowing }
followersCount(userId)
listFollowingIds(userId)
suggestUsers(currentUserId, limit?)  -> ProfileDTO[]
```

`@/lib/data/notifications`
```ts
listNotifications(userId, { limit, cursor }) -> { notifications: NotificationDTO[]; nextCursor }
unreadNotificationCount(userId)            -> number
createNotification({ userId, actorId, type, postId? })   // no-op if userId === actorId
createNotifications([...])
markNotificationRead(id, userId)   // throws 404 if not found or not owned
markAllNotificationsRead(userId)   -> number
```

`@/lib/data/conversations`
```ts
getConversation(id, currentUserId)              -> ConversationDTO
listConversations(currentUserId)                -> ConversationDTO[]
totalUnreadCount(currentUserId)                 -> number
openPrivateConversation(currentUserId, otherId) -> { conversation, created }
createGroupConversation(creatorId, name, participantIds) -> ConversationDTO
listMessages(convId, currentUserId, { limit, cursor }) -> { messages: MessageDTO[]; nextCursor }
sendMessage(convId, senderId, content)          -> MessageDTO
markConversationRead(convId, userId)
assertMember(convId, userId)
recipientIds(convId, senderId)                  -> string[]
```

`@/lib/data/communities`
```ts
listCommunities({ query?, limit?, currentUserId? })   -> CommunityDTO[]
getCommunity(idOrSlug, currentUserId?)                -> CommunityDTO
getCommunityDetail(idOrSlug, currentUserId?)          -> { community, members }
createCommunity(ownerId, name, description?)          -> CommunityDTO
joinCommunity(id, userId)     -> { isMember, membersCount }
leaveCommunity(id, userId)    -> { isMember, membersCount }
updateCommunity(id, ownerId, { name?, description? }) -> CommunityDTO
deleteCommunity(id, ownerId)
setMemberRole(communityId, ownerId, targetUserId, 'admin' | 'member')
listUserCommunities(userId)
```

`@/lib/data/moderation`
```ts
createReport({ reporterId, targetType, targetUserId, targetPostId?, reason })
listReports({ status?, limit?, cursor? })      -> { reports: AdminReport[]; nextCursor }
updateReportStatus(id, status)                 -> AdminReport
requestVerification(userId, reason)
listVerifications({ status?, limit?, cursor? }) -> { requests, nextCursor }
updateVerificationStatus(id, 'approved' | 'rejected', note?)
searchUsers({ query?, role?, limit?, cursor? }) -> { users: ProfileDTO[]; nextCursor }
setUserRole(adminId, targetId, 'user' | 'admin')
setUserVerified(adminId, targetId, boolean)
getAdminStats()
```

`@/lib/storage` (R2 — replaces the old `sharp` + filesystem upload)
```ts
isMediaBucket(v), BUCKET_MAX_BYTES, MEDIA_BUCKETS
putObject(bucket, bytes, contentType, id?) -> { key, url, size, contentType }
getObject(key) / deleteObject(key) / tryDeleteObject(key)
normalizeObjectKey(raw)
```

## Ids

`newId(at?: number | Date)` from `@/lib/ids` produces a **time-sortable** id
(9 base36 chars of ms timestamp + 12 random chars). Always generate ids in JS —
never `AUTOINCREMENT`, never `Date.now()` alone. `newToken()` is for secrets.

## Response shapes the frontend already expects

Do not change these — the client components are written against them.

- `GET /api/posts` → `{ posts: PostDTO[], nextCursor: string | null }`
- `POST /api/posts` → `{ post: PostDTO }`
- `GET|DELETE /api/posts/[id]` → `{ post: PostDTO }` / `{ success: true }`
- `POST|DELETE /api/posts/[id]/{like,repost,bookmark}` → `{ liked|reposted|bookmarked, likeCount|repostCount|bookmarkCount }`
- `GET /api/posts/[id]/comments` → `{ posts: PostDTO[], nextCursor }`
- `GET /api/profiles/[username]` → **bare `ProfileDTO`** (not wrapped)
- `GET|PATCH /api/profiles/me` → **bare `ProfileDTO`**
- `PATCH /api/profiles/me/interests` → **bare `ProfileDTO`**
- `POST|DELETE /api/follow` → `{ isFollowing, followersCount }`
- `GET /api/profiles/[username]/posts` → `{ posts: PostDTO[], nextCursor }`
- `GET /api/search` → `{ posts, users, communities }`
- `GET /api/explore` → `{ trending: { tag, postsCount }[], suggestedUsers, trendingPosts }`
- `GET /api/explore/suggestions` → `{ users: ProfileDTO[] }`
- `GET /api/notifications` → `{ notifications, unreadCount, nextCursor }`, or `?unread=1` → `{ unreadCount }`
- `POST /api/notifications/read` → `{ success: true }`
- `GET /api/conversations` → `{ conversations: ConversationDTO[] }`
- `POST /api/conversations` → `{ conversation }` (201 new, 200 existing)
- `GET /api/conversations/[id]` → `{ conversation }`
- `GET /api/conversations/[id]/messages` → `{ messages, nextCursor }`
- `POST /api/conversations/[id]/messages` → `{ message }`
- `POST /api/conversations/[id]/read` → `{ success: true }`
- `GET /api/communities` → `{ communities: CommunityDTO[] }`
- `POST /api/communities` → `{ community }`
- `GET /api/communities/[id]` → `{ community, members }`
- `PATCH /api/communities/[id]` → `{ community }` (owner only)
- `DELETE /api/communities/[id]` → `{ success: true }` (owner only)
- `POST|DELETE /api/communities/[id]/join` → `{ isMember, membersCount }`
- `POST /api/verifications` → `{ success: true }` (201)
- `GET /api/auth/me` → `{ user }`, with `user: null` when signed out (200, not 401)
- `GET /api/auth/check-username` → `{ available, reason }`, reason ∈ `empty|invalid|taken|self|free`
- `GET /api/admin/stats` → `{ users, posts, replies, likes, communities, conversations, reports:{pending,resolved}, verifications:{pending}, growth:[{date,users,posts}] }`
- `GET /api/admin/reports` → `{ reports: [{ id, reporter, target, targetPost, targetType, reason, status, createdAt }], nextCursor }`
- `PATCH /api/admin/reports/[id]` → `{ report }`
- `GET /api/admin/verifications` → `{ requests: [{ id, user: ProfileDTO | null, reason, status, createdAt }], nextCursor }`
- `PATCH /api/admin/verifications/[id]` → `{ request: { id, user, reason, status, note, createdAt } }`
- `GET /api/admin/users` → `{ users: ProfileDTO[], nextCursor }`
- `PATCH /api/admin/users/[id]` → **bare `ProfileDTO`**
- `POST /api/upload` → `{ url: '/uploads/<key>', fileName: '<key>' }`
- `GET /uploads/[...path]` → the stored object, streamed with an immutable `cache-control`

Note the asymmetry: most profile reads return a **bare** `ProfileDTO`, not
`{ user: ... }`. The existing clients read fields off the top level, so wrapping
them breaks three screens.

## Handler shape

```ts
export const GET = withErrorHandler(async (req, ctx) => {
  const params = await ctx.params          // ctx.params is a Promise in Next 16
  const id = Array.isArray(params.id) ? params.id[0] : params.id
  ...
})
```

`withErrorHandler` accepts handlers returning either `NextResponse` or a plain
`Response`. Note that a Next.js route handler **cannot** return a `101` upgrade:
the response is normalised and the WebSocket is dropped. The chat socket is
therefore intercepted in `worker.ts` before the request reaches Next.

## Reference implementation

`src/app/api/auth/register/route.ts` and `src/app/api/auth/login/route.ts` are the
canonical pattern. Follow their structure exactly.