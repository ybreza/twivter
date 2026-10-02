/**
 * End-to-end smoke test against a running dev server.
 *
 *   node scripts/smoke.mjs [baseUrl]
 *
 * Exercises the paths that were previously broken: pagination limits, orphaned
 * notifications, case-insensitive usernames, DM dedupe, unread counts, and the
 * owner-management gaps in communities.
 */

const BASE = process.argv[2] ?? 'http://localhost:3000'

let passed = 0
let failed = 0
const failures = []

function check(name, condition, detail = '') {
  if (condition) {
    passed++
    console.log(`  PASS  ${name}`)
  } else {
    failed++
    failures.push(`${name}${detail ? ` — ${detail}` : ''}`)
    console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`)
  }
}

class Session {
  constructor(label) {
    this.label = label
    this.cookie = ''
  }

  async call(method, path, body) {
    const headers = {}
    if (this.cookie) headers.cookie = this.cookie
    if (body !== undefined) headers['content-type'] = 'application/json'

    const res = await fetch(`${BASE}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      redirect: 'manual',
    })

    const setCookie = res.headers.getSetCookie?.() ?? []
    for (const raw of setCookie) {
      const pair = raw.split(';')[0]
      if (pair.startsWith('twivter_session=')) this.cookie = pair
    }

    const text = await res.text()
    let json = null
    try {
      json = text ? JSON.parse(text) : null
    } catch {
      json = { _raw: text.slice(0, 200) }
    }
    return { status: res.status, body: json }
  }

  get(path) {
    return this.call('GET', path)
  }
  post(path, body) {
    return this.call('POST', path, body ?? {})
  }
  patch(path, body) {
    return this.call('PATCH', path, body)
  }
  del(path, body) {
    return this.call('DELETE', path, body)
  }
}

console.log(`\nTwivter smoke test → ${BASE}\n`)

// ── Health ───────────────────────────────────────────────────────────────────
console.log('auth')
const anon = new Session('anon')
const me = await anon.get('/api/auth/me')
check('GET /api/auth/me returns 200 with user:null when signed out', me.status === 200 && me.body?.user === null, `status=${me.status}`)

const noAuth = await anon.get('/api/notifications')
check('GET /api/notifications is 401 without a session', noAuth.status === 401, `status=${noAuth.status}`)

// ── Login ────────────────────────────────────────────────────────────────────
const admin = new Session('admin')
const login = await admin.post('/api/auth/login', {
  email: 'yowanda@twivter.com',
  password: 'password123',
})
// Capture the id once: `session.body` is overwritten by every later call.
const adminId = login.body?.user?.id
check('admin login succeeds', login.status === 200 && login.body?.user?.role === 'admin', `status=${login.status} body=${JSON.stringify(login.body).slice(0, 160)}`)

const badLogin = await new Session('bad').post('/api/auth/login', {
  email: 'yowanda@twivter.com',
  password: 'wrong-password',
})
check('login with a wrong password is 401', badLogin.status === 401, `status=${badLogin.status}`)

const unknownLogin = await new Session('unknown').post('/api/auth/login', {
  email: 'nobody@twivter.com',
  password: 'password123',
})
check(
  'login with an unknown email is 401 with the same message (no enumeration)',
  unknownLogin.status === 401 && unknownLogin.body?.error === badLogin.body?.error,
  `status=${unknownLogin.status}`,
)

const sara = new Session('sara')
const saraLogin = await sara.post('/api/auth/login', { email: 'sara@twivter.com', password: 'password123' })
check('second user login succeeds', saraLogin.status === 200, `status=${saraLogin.status}`)

// ── Session revocation ───────────────────────────────────────────────────────
console.log('\nsessions')
const throwaway = new Session('throwaway')
await throwaway.post('/api/auth/login', { email: 'bagus@twivter.com', password: 'password123' })
const beforeLogout = await throwaway.get('/api/auth/me')
check('session is valid before logout', beforeLogout.status === 200 && beforeLogout.body?.user?.id)
await throwaway.post('/api/auth/logout')
const afterLogout = await throwaway.get('/api/auth/me')
check('session is dead after logout (server-side revocation)', afterLogout.status === 200 && afterLogout.body?.user === null)

// ── Pagination limits ────────────────────────────────────────────────────────
console.log('\npagination')
for (const [path, label] of [
  ['/api/posts?feed=explore&limit=0', 'GET /api/posts?limit=0'],
  ['/api/posts?feed=explore&limit=-5', 'GET /api/posts?limit=-5'],
  ['/api/posts?feed=explore&limit=abc', 'GET /api/posts?limit=abc'],
  ['/api/notifications?limit=0', 'GET /api/notifications?limit=0'],
]) {
  const res = await admin.get(path)
  check(`${label} does not 500`, res.status !== 500, `status=${res.status}`)
  if (res.status === 200 && label.includes('/api/posts')) {
    check(`${label} returns an array`, Array.isArray(res.body?.posts), `got=${typeof res.body?.posts}`)
  }
}

const page1 = await admin.get('/api/posts?feed=explore&limit=5')
check('first page returns 5 posts', page1.body?.posts?.length === 5, `len=${page1.body?.posts?.length}`)
if (page1.body?.nextCursor) {
  const page2 = await admin.get(`/api/posts?feed=explore&limit=5&cursor=${page1.body.nextCursor}`)
  const ids1 = new Set(page1.body.posts.map((p) => p.id))
  const overlap = (page2.body?.posts ?? []).filter((p) => ids1.has(p.id))
  check('page 2 does not repeat page 1 rows', overlap.length === 0, `overlap=${overlap.length}`)
} else {
  console.log('  SKIP  page-2 dedupe (no cursor)')
}

// ── Notifications with a deleted post ────────────────────────────────────────
console.log('\nnotifications')
const sarasNotifs = await sara.get('/api/notifications')
check('notifications endpoint responds 200', sarasNotifs.status === 200, `status=${sarasNotifs.status}`)
check(
  'every notification has an actor',
  (sarasNotifs.body?.notifications ?? []).every((n) => n.actor?.id),
)

// Create a post, like it as Sara, then delete the post as the author and confirm
// the notification feed still renders (this used to 500 permanently).
const newPost = await admin.post('/api/posts', { content: 'smoke test: notifikasi yatim' })
check('create post', newPost.status === 200 && newPost.body?.post?.id, `status=${newPost.status}`)
if (newPost.body?.post?.id) {
  const postId = newPost.body.post.id
  const like = await sara.post(`/api/posts/${postId}/like`)
  check('like post', like.status === 200 && like.body?.liked === true, `status=${like.status}`)

  const beforeDelete = await admin.get('/api/notifications?limit=10')
  check('notifications feed works while the post exists', beforeDelete.status === 200, `status=${beforeDelete.status}`)

  const del = await admin.del(`/api/posts/${postId}`)
  check('delete own post', del.status === 200, `status=${del.status}`)

  const afterDelete = await admin.get('/api/notifications?limit=10')
  check(
    'notifications feed still 200 after the referenced post is deleted',
    afterDelete.status === 200,
    `status=${afterDelete.status} body=${JSON.stringify(afterDelete.body).slice(0, 120)}`,
  )
  check(
    'the orphaned notification reports post:null rather than crashing',
    (afterDelete.body?.notifications ?? []).every((n) => n.post === null || typeof n.post.id === 'string'),
  )
}

// ── Username case-insensitivity ──────────────────────────────────────────────
console.log('\nusername rules')
const upper = await admin.get('/api/auth/check-username?username=SARA')
check('check-username is case-insensitive (SARA taken)', upper.body?.available === false && upper.body?.reason === 'taken', JSON.stringify(upper.body))

const mixedCase = await admin.patch('/api/profiles/me', { username: 'YoWaNdA' })
check('PATCH to a differently-cased own username is allowed', mixedCase.status === 200, `status=${mixedCase.status} ${JSON.stringify(mixedCase.body).slice(0, 120)}`)
if (mixedCase.status === 200) {
  await admin.patch('/api/profiles/me', { username: 'yowanda' })
}

const lookups = await Promise.all([
  admin.get('/api/profiles/sara'),
  admin.get('/api/profiles/SARA'),
  admin.get('/api/profiles/SaRa'),
])
check('profile lookup is case-insensitive and consistent', lookups.every((r) => r.status === 200 && r.body?.username === 'sara'), lookups.map((r) => r.status).join(','))

// ── Body validation ──────────────────────────────────────────────────────────
console.log('\nvalidation')
// bio/location accept `null` (clear the field) and coerce scalars to text, so
// these must succeed. What must never happen is a 500.
for (const [label, body] of [
  ['bio:null', { bio: null }],
  ['bio:number', { bio: 12345 }],
  ['location:null', { location: null }],
  ['bio:object', { bio: { a: 1 } }],
  ['avatarUrl:javascript', { avatarUrl: 'javascript:alert(1)' }],
  ['avatarUrl:data', { avatarUrl: 'data:text/html,<script>' }],
  ['website:ftp', { website: 'ftp://example.com' }],
  ['username:bad chars', { username: 'not a valid name!' }],
]) {
  const res = await admin.patch('/api/profiles/me', body)
  check(`PATCH profile with ${label} is not a 500`, res.status < 500, `status=${res.status}`)
}

// These must be rejected outright.
for (const [label, body] of [
  ['avatarUrl:javascript', { avatarUrl: 'javascript:alert(1)' }],
  ['avatarUrl:data', { avatarUrl: 'data:text/html,<script>' }],
  ['website:ftp', { website: 'ftp://example.com' }],
  ['username:bad chars', { username: 'not a valid name!' }],
]) {
  const res = await admin.patch('/api/profiles/me', body)
  check(`PATCH profile rejects ${label} with 4xx`, res.status >= 400 && res.status < 500, `status=${res.status}`)
}

const badMedia = await admin.post('/api/posts', {
  content: 'x',
  media: [{ url: 'javascript:alert(1)', type: 'image' }],
})
check('media url javascript: is rejected with 4xx', badMedia.status >= 400 && badMedia.status < 500, `status=${badMedia.status}`)

const tooManyMedia = await admin.post('/api/posts', {
  content: 'x',
  media: Array.from({ length: 9 }, () => ({ url: '/uploads/posts/a.webp', type: 'image' })),
})
check('more than 4 media items is rejected with 4xx', tooManyMedia.status >= 400 && tooManyMedia.status < 500, `status=${tooManyMedia.status}`)

const badParent = await admin.post('/api/posts', { content: 'x', replyToId: 'does-not-exist' })
check('reply to a nonexistent post is 404, not 500', badParent.status === 404, `status=${badParent.status}`)

const badSearchType = await admin.get('/api/search?q=a&type=bogus')
check('unknown search type is 400', badSearchType.status === 400, `status=${badSearchType.status}`)

// ── Follow idempotency + case-insensitive target ─────────────────────────────
console.log('\nsocial graph')
const follow1 = await admin.post('/api/follow', { username: 'NINA' })
check('follow by mixed-case username works', follow1.status === 200 && follow1.body?.isFollowing === true, `status=${follow1.status} ${JSON.stringify(follow1.body).slice(0, 120)}`)
const follow2 = await admin.post('/api/follow', { username: 'nina' })
check('double follow is idempotent, not 500', follow2.status === 200 && follow2.body?.isFollowing === true, `status=${follow2.status}`)
const unfollow = await admin.del('/api/follow?username=NINA')
check('unfollow works', unfollow.status === 200 && unfollow.body?.isFollowing === false, `status=${unfollow.status}`)

const selfFollow = await admin.post('/api/follow', { username: 'yowanda' })
check('self-follow is 400', selfFollow.status === 400, `status=${selfFollow.status}`)

// ── Messaging ────────────────────────────────────────────────────────────────
console.log('\nmessaging')
const convs = await admin.get('/api/conversations')
check('GET /api/conversations returns 200', convs.status === 200 && Array.isArray(convs.body?.conversations), `status=${convs.status}`)

const withUnread = (convs.body?.conversations ?? []).filter((c) => c.unreadCount > 0)
console.log(`  INFO  ${convs.body?.conversations?.length ?? 0} conversations, ${withUnread.length} with unread`)

// Send several messages from a peer so the unread badge must exceed 1.
//
// Pick a private conversation whose peer is a seeded demo account we can
// actually log in as. This used to take the first private conversation and
// assume its peer's email was `<username>@twivter.com` — true only for seeded
// users. On a database that also holds real signups the first peer is usually a
// real account, so the suite failed with a misleading "peer login" error even
// though the app was fine.
const privateConvs = (convs.body?.conversations ?? []).filter((c) => c.type === 'private')
let privateConv = null
let peerSession = null
for (const conv of privateConvs) {
  // `members` excludes the viewer, so members[0] is the other participant.
  const peer = conv.members[0]
  if (!peer?.username) continue
  const candidate = new Session(`peer-${peer.username}`)
  const login = await candidate.post('/api/auth/login', {
    email: `${peer.username}@twivter.com`,
    password: 'password123',
  })
  if (login.status === 200) {
    privateConv = conv
    peerSession = candidate
    break
  }
}

// The membership checks below only need *a* private conversation.
const accessConv = privateConv ?? privateConvs[0]

if (privateConv) {
  for (let i = 0; i < 3; i++) {
    const sent = await peerSession.post(`/api/conversations/${privateConv.id}/messages`, {
      content: `smoke ${i}`,
    })
    if (sent.status !== 200) {
      check('send message', false, `status=${sent.status} ${JSON.stringify(sent.body).slice(0, 160)}`)
      break
    }
  }
  const after = await admin.get('/api/conversations')
  const refreshed = (after.body?.conversations ?? []).find((c) => c.id === privateConv.id)
  check(
    'unreadCount is a real count (>1), not capped at 0 or 1',
    (refreshed?.unreadCount ?? 0) > 1,
    `unreadCount=${refreshed?.unreadCount}`,
  )

  const bogusCursor = await peerSession.get(
    `/api/conversations/${privateConv.id}/messages?cursor=not-a-date`,
  )
  check('garbage message cursor is not a 500', bogusCursor.status !== 500, `status=${bogusCursor.status}`)
} else {
  console.log(
    '  INFO  no seeded demo peer among private conversations; ' +
      'skipping message-send, unread-count and cursor checks',
  )
}

if (accessConv) {
  const outsider = new Session('outsider')
  await outsider.post('/api/auth/login', { email: 'dewi@twivter.com', password: 'password123' })
  const peek = await outsider.get(`/api/conversations/${accessConv.id}`)
  check('non-member cannot read a conversation (403)', peek.status === 403, `status=${peek.status}`)
  const peekMsgs = await outsider.get(`/api/conversations/${accessConv.id}/messages`)
  check('non-member cannot read messages (403)', peekMsgs.status === 403, `status=${peekMsgs.status}`)
  const peekSend = await outsider.post(`/api/conversations/${accessConv.id}/messages`, { content: 'x' })
  check('non-member cannot post to a conversation (403)', peekSend.status === 403, `status=${peekSend.status}`)
}

// DM creation must be idempotent (dmKey UNIQUE index).
const dm1 = await admin.post('/api/conversations', { participantId: saraLogin.body?.user?.id })
const dm2 = await admin.post('/api/conversations', { participantId: saraLogin.body?.user?.id })
check(
  'opening the same DM twice returns the same conversation',
  dm1.body?.conversation?.id === dm2.body?.conversation?.id,
  `${dm1.body?.conversation?.id} vs ${dm2.body?.conversation?.id}`,
)

// ── Communities ──────────────────────────────────────────────────────────────
console.log('\ncommunities')
const communities = await admin.get('/api/communities')
check('GET /api/communities returns 200', communities.status === 200 && Array.isArray(communities.body?.communities), `status=${communities.status}`)

const owned = (communities.body?.communities ?? []).find((c) => c.role === 'owner')
if (owned) {
  const renamed = await admin.patch(`/api/communities/${owned.id}`, { description: 'smoke test edit' })
  check('owner can edit a community', renamed.status === 200, `status=${renamed.status}`)
  const notOwner = await sara.patch(`/api/communities/${owned.id}`, { description: 'nope' })
  check('non-owner cannot edit a community (403)', notOwner.status === 403, `status=${notOwner.status}`)
} else {
  console.log('  SKIP  community ownership checks (admin owns none)')
}

// ── Verification queue ───────────────────────────────────────────────────────
console.log('\nverification')
const VERIFY_REASON =
  'Saya fotografer profesional dengan portofolio yang konsisten selama lima tahun terakhir.'
// The seed already has a pending request for Sara, so 409 is the correct
// outcome on a re-run. Accept either, but never 500.
const req = await sara.post('/api/verifications', { reason: VERIFY_REASON })
check(
  'POST /api/verifications creates or rejects a duplicate with 201/409',
  req.status === 201 || req.status === 409,
  `status=${req.status} ${JSON.stringify(req.body).slice(0, 120)}`,
)
const shortReason = await sara.post('/api/verifications', { reason: 'pendek' })
check('verification reason that is too short is 400', shortReason.status === 400, `status=${shortReason.status}`)

const pending = await admin.get('/api/admin/verifications?status=pending')
check('admin can list pending verifications', pending.status === 200 && Array.isArray(pending.body?.requests), `status=${pending.status}`)
check(
  'every request has a non-null user in this dataset',
  (pending.body?.requests ?? []).every((r) => r.user),
  'found a request with user:null',
)

// Approving must set verified; rejecting must revoke it.
const firstPending = pending.body?.requests?.[0]
if (firstPending) {
  const approve = await admin.patch(`/api/admin/verifications/${firstPending.id}`, { status: 'approved' })
  check('admin can approve a verification', approve.status === 200, `status=${approve.status} ${JSON.stringify(approve.body).slice(0, 120)}`)
  const profileAfter = await admin.get(`/api/profiles/${firstPending.user.username}`)
  check('approving sets User.verified', profileAfter.body?.verified === true, `verified=${profileAfter.body?.verified}`)

  const reject = await admin.patch(`/api/admin/verifications/${firstPending.id}`, { status: 'rejected' })
  check('admin can reject a verification', reject.status === 200, `status=${reject.status}`)
  const profileAfter2 = await admin.get(`/api/profiles/${firstPending.user.username}`)
  check(
    'rejecting revokes User.verified (previously it stayed true)',
    profileAfter2.body?.verified === false,
    `verified=${profileAfter2.body?.verified}`,
  )
}

// ── Reports ──────────────────────────────────────────────────────────────────
console.log('\nreports')
const badReport = await sara.post('/api/reports', { targetId: saraLogin.body?.user?.id, targetType: 'user', reason: 'short' })
check('report reason that is too short is 400', badReport.status === 400, `status=${badReport.status}`)
const selfReport = await sara.post('/api/reports', { targetId: saraLogin.body?.user?.id, targetType: 'user', reason: 'melapor diri sendiri sendiri' })
check('self-report is rejected', selfReport.status >= 400 && selfReport.status < 500, `status=${selfReport.status}`)

// ── Admin ────────────────────────────────────────────────────────────────────
console.log('\nadmin')
const forbidden = await sara.get('/api/admin/stats')
check('non-admin cannot read /api/admin/stats (403)', forbidden.status === 403, `status=${forbidden.status}`)

const stats = await admin.get('/api/admin/stats')
check('GET /api/admin/stats returns 200', stats.status === 200, `status=${stats.status}`)
check('stats.growth has 7 buckets', stats.body?.growth?.length === 7, `len=${stats.body?.growth?.length}`)
check('replies are counted separately from posts', typeof stats.body?.replies === 'number')

const adminUsers = await admin.get('/api/admin/users?q=YOW')
check('admin user search is case-insensitive and finds a match', adminUsers.status === 200 && (adminUsers.body?.users?.length ?? 0) >= 1, `status=${adminUsers.status} len=${adminUsers.body?.users?.length}`)
check('admin user search returns a usable cursor', adminUsers.body?.nextCursor !== undefined)

const demote = await admin.patch(`/api/admin/users/${adminId}`, { role: 'user' })
check('admin cannot demote themselves (400)', demote.status === 400, `status=${demote.status}`)
const promoteOther = await admin.patch(`/api/admin/users/${saraLogin.body?.user?.id}`, { verified: true })
check('admin can verify another user', promoteOther.status === 200 && promoteOther.body?.verified === true, `status=${promoteOther.status}`)
const stillAdmin = await admin.get('/api/auth/me')
check('demoting self was rejected, admin role intact', stillAdmin.body?.user?.role === 'admin')

// ── Explore ──────────────────────────────────────────────────────────────────
console.log('\nexplore')
const explore = await admin.get('/api/explore')
check('GET /api/explore returns 200', explore.status === 200, `status=${explore.status}`)
check('trending is a non-empty array', (explore.body?.trending?.length ?? 0) > 0)
check('trending items use postsCount', explore.body?.trending?.every((t) => typeof t.postsCount === 'number'))
check('suggestedUsers is an array', Array.isArray(explore.body?.suggestedUsers))
check('trendingPosts is an array', Array.isArray(explore.body?.trendingPosts))

// ── Profile posts tabs ───────────────────────────────────────────────────────
console.log('\nprofile posts')
for (const tab of ['posts', 'replies', 'media', 'likes', 'bogus']) {
  const res = await admin.get(`/api/profiles/sara/posts?tab=${tab}&limit=5`)
  const expected = tab === 'bogus' ? 400 : 200
  check(`profile tab "${tab}" → ${expected}`, res.status === expected, `status=${res.status}`)
}

// ── Post interactions ────────────────────────────────────────────────────────
console.log('\ninteractions')
const anyPost = (await admin.get('/api/posts?feed=explore&limit=1')).body?.posts?.[0]
if (anyPost) {
  const id = anyPost.id
  const like = await sara.post(`/api/posts/${id}/like`)
  check('like returns liked + likeCount', like.status === 200 && typeof like.body?.likeCount === 'number', `status=${like.status}`)
  const likeAgain = await sara.post(`/api/posts/${id}/like`)
  check('double like is idempotent', likeAgain.status === 200 && likeAgain.body?.liked === true, `status=${likeAgain.status}`)
  const unlike = await sara.del(`/api/posts/${id}/like`)
  check('unlike works', unlike.status === 200 && unlike.body?.liked === false, `status=${unlike.status}`)
  const ghost = await sara.del('/api/posts/does-not-exist/like')
  check('unliking a nonexistent post is 404, not 200', ghost.status === 404, `status=${ghost.status}`)
}

// ── Upload ───────────────────────────────────────────────────────────────────
console.log('\nuploads')
const traversal = await admin.post('/api/upload', { file: 'x', bucket: '../../../etc' })
check('upload rejects an unknown bucket (no path traversal)', traversal.status >= 400 && traversal.status < 500, `status=${traversal.status}`)
const noFile = await admin.post('/api/upload', { bucket: 'posts' })
check('upload without a file is 4xx', noFile.status >= 400 && noFile.status < 500, `status=${noFile.status}`)

// ── Logout ───────────────────────────────────────────────────────────────────
console.log('\nlogout')
const logout = await admin.post('/api/auth/logout')
check('logout returns 200', logout.status === 200, `status=${logout.status}`)
const afterLogout2 = await admin.get('/api/auth/me')
check('session is gone after logout', afterLogout2.body?.user === null)

// ── Summary ──────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(60)}`)
console.log(`passed: ${passed}   failed: ${failed}`)
if (failures.length) {
  console.log('\nFailures:')
  for (const f of failures) console.log(`  • ${f}`)
}
console.log('')
process.exit(failed === 0 ? 0 : 1)