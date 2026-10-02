/**
 * Verifies the two Cloudflare-only pieces the HTTP smoke test cannot cover:
 * R2 uploads and the Durable Object chat WebSocket.
 *
 *   node scripts/verify-cloud.mjs [baseUrl]
 */

import https from 'node:https'

const BASE = process.argv[2] ?? 'https://twivter.android-ac3h.workers.dev'

let passed = 0
let failed = 0

function check(name, ok, detail = '') {
  if (ok) {
    passed++
    console.log(`  PASS  ${name}`)
  } else {
    failed++
    console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`)
  }
}

// ── Login ────────────────────────────────────────────────────────────────────
console.log('\nlogin')
let cookie = ''
const login = await fetch(`${BASE}/api/auth/login`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ email: 'yowanda@twivter.com', password: 'password123' }),
})
for (const raw of login.headers.getSetCookie?.() ?? []) {
  const pair = raw.split(';')[0]
  if (pair.startsWith('twivter_session=')) cookie = pair
}
check('login works against the deployed Worker', login.status === 200 && Boolean(cookie), `status=${login.status}`)
if (!cookie) {
  console.log('\ncannot continue without a session')
  process.exit(1)
}

// ── R2 upload + fetch ────────────────────────────────────────────────────────
console.log('\nR2 media')

/** Builds a tiny valid PNG so the probe needs no fixture file. */
function makePng() {
  const chunk = (type, data) => {
    const len = Buffer.alloc(4)
    len.writeUInt32BE(data.length)
    const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
    const table = []
    for (let n = 0; n < 256; n++) {
      let c = n
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
      table[n] = c >>> 0
    }
    let crc = 0xffffffff
    for (const byte of body) crc = table[(crc ^ byte) & 0xff] ^ (crc >>> 8)
    const crcBuf = Buffer.alloc(4)
    crcBuf.writeUInt32BE((crc ^ 0xffffffff) >>> 0)
    return Buffer.concat([len, body, crcBuf])
  }

  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(4, 0)
  ihdr.writeUInt32BE(4, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 2 // truecolour

  // One zlib stream holding a 4x4 RGB scanline set (all zero pixels).
  const raw = Buffer.alloc(4 * (1 + 4 * 3))
  const idat = chunk('IDAT', Buffer.from('789c6300010000050001', 'hex').subarray(0, 11))

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', Buffer.concat([Buffer.from([0x78, 0x9c]), deflateStored(raw)])),
    chunk('IEND', Buffer.alloc(0)),
  ])
  void idat
}

/** zlib "stored" (uncompressed) deflate — avoids needing a compressor. */
function deflateStored(data) {
  const blocks = []
  for (let i = 0; i < data.length; i += 65535) {
    const slice = data.subarray(i, i + 65535)
    const last = i + 65535 >= data.length ? 1 : 0
    const head = Buffer.alloc(5)
    head[0] = last
    head.writeUInt16LE(slice.length, 1)
    head.writeUInt16LE(~slice.length & 0xffff, 3)
    blocks.push(head, slice)
  }
  const tail = Buffer.alloc(4)
  tail.writeUInt32BE(adler32(data), 0)
  return Buffer.concat([...blocks, tail])
}

function adler32(buf) {
  let a = 1
  let b = 0
  for (const byte of buf) {
    a = (a + byte) % 65521
    b = (b + a) % 65521
  }
  return ((b << 16) | a) >>> 0
}

const form = new FormData()
form.append('file', new Blob([makePng()], { type: 'image/png' }), 'probe.png')
form.append('bucket', 'posts')

const upload = await fetch(`${BASE}/api/upload`, { method: 'POST', headers: { cookie }, body: form })
const uploadBody = await upload.json().catch(() => null)
check(
  'POST /api/upload stores the file in R2',
  upload.status === 200 && typeof uploadBody?.url === 'string' && uploadBody.url.startsWith('/uploads/'),
  `status=${upload.status} body=${JSON.stringify(uploadBody).slice(0, 200)}`,
)

if (uploadBody?.url) {
  console.log(`  INFO  stored at ${uploadBody.url}`)
  const fetchBack = await fetch(`${BASE}${uploadBody.url}`)
  const bytes = Buffer.from(await fetchBack.arrayBuffer())
  check(
    'GET /uploads/... streams the object back from R2',
    fetchBack.status === 200 && bytes.length > 0,
    `status=${fetchBack.status} bytes=${bytes.length}`,
  )
  check(
    'served with an immutable cache-control',
    /immutable/.test(fetchBack.headers.get('cache-control') ?? ''),
    `cache-control=${fetchBack.headers.get('cache-control')}`,
  )
  check(
    'correct content-type',
    (fetchBack.headers.get('content-type') ?? '').startsWith('image/'),
    `content-type=${fetchBack.headers.get('content-type')}`,
  )
  const etag = fetchBack.headers.get('etag')
  if (etag) {
    const conditional = await fetch(`${BASE}${uploadBody.url}`, { headers: { 'if-none-match': etag } })
    check('conditional request returns 304', conditional.status === 304, `status=${conditional.status}`)
  }

  const traversal = await fetch(`${BASE}/uploads/../../etc/passwd`)
  check(
    'path traversal on /uploads is rejected',
    traversal.status === 404 || traversal.status === 400,
    `status=${traversal.status}`,
  )
  const missing = await fetch(`${BASE}/uploads/posts/1999/01/does-not-exist.webp`)
  check('missing object is 404', missing.status === 404, `status=${missing.status}`)
}

// ── Durable Object WebSocket ─────────────────────────────────────────────────
// A raw upgrade is used deliberately: the WHATWG `WebSocket` constructor cannot
// set headers, so it cannot send the session cookie and would always get a 401.
// Browsers attach cookies to the handshake automatically, so this is a limit of
// the test harness rather than of the app.
console.log('\nDurable Object chat socket')

function encodeTextFrame(text) {
  const payload = Buffer.from(text, 'utf8')
  const mask = Buffer.from([0, 0, 0, 0]) // client frames must be masked
  let header
  if (payload.length < 126) {
    header = Buffer.from([0x81, 0x80 | payload.length])
  } else if (payload.length < 65536) {
    header = Buffer.alloc(4)
    header[0] = 0x81
    header[1] = 0x80 | 126
    header.writeUInt16BE(payload.length, 2)
  } else {
    header = Buffer.alloc(10)
    header[0] = 0x81
    header[1] = 0x80 | 127
    header.writeBigUInt64BE(BigInt(payload.length), 2)
  }
  return Buffer.concat([header, mask, payload])
}

/** Decodes every complete text frame in the buffer. */
function decodeTextFrames(buffer) {
  const messages = []
  let offset = 0
  while (offset + 2 <= buffer.length) {
    const opcode = buffer[offset] & 0x0f
    const masked = (buffer[offset + 1] & 0x80) !== 0
    let length = buffer[offset + 1] & 0x7f
    let headerLength = 2
    if (length === 126) {
      if (offset + 4 > buffer.length) break
      length = buffer.readUInt16BE(offset + 2)
      headerLength = 4
    } else if (length === 127) {
      if (offset + 10 > buffer.length) break
      length = Number(buffer.readBigUInt64BE(offset + 2))
      headerLength = 10
    }
    let cursor = offset + headerLength
    let maskKey = null
    if (masked) {
      if (cursor + 4 > buffer.length) break
      maskKey = buffer.subarray(cursor, cursor + 4)
      cursor += 4
    }
    if (cursor + length > buffer.length) break
    const payload = Buffer.from(buffer.subarray(cursor, cursor + length))
    if (maskKey) for (let i = 0; i < payload.length; i++) payload[i] ^= maskKey[i % 4]
    if (opcode === 0x1) messages.push(payload.toString('utf8'))
    offset = cursor + length
  }
  return { messages, rest: buffer.subarray(offset) }
}

/** Opens a raw WebSocket, optionally sends one frame, and collects replies. */
function openSocket(url, cookieHeader, { send = null, durationMs = 6000 } = {}) {
  const u = new URL(url)
  return new Promise((resolve) => {
    const messages = []
    let settled = false
    let socket = null

    const finish = (extra) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      try {
        socket?.destroy()
      } catch {}
      resolve({ ...extra, messages })
    }

    const timer = setTimeout(() => finish({ upgraded: true, timedOut: true }), durationMs)

    const req = https.request({
      hostname: u.hostname,
      port: u.port || 443,
      path: u.pathname + u.search,
      method: 'GET',
      headers: {
        connection: 'Upgrade',
        upgrade: 'websocket',
        'sec-websocket-key': 'dGhlIHNhbXBsZSBub25jZQ==',
        'sec-websocket-version': '13',
        ...(cookieHeader ? { cookie: cookieHeader } : {}),
      },
    })

    req.on('upgrade', (res, ws) => {
      socket = ws
      let buffered = Buffer.alloc(0)
      ws.on('data', (chunk) => {
        buffered = Buffer.concat([buffered, chunk])
        const decoded = decodeTextFrames(buffered)
        buffered = decoded.rest
        messages.push(...decoded.messages)
      })
      ws.on('error', () => {})
      if (send) ws.write(encodeTextFrame(send))
    })
    req.on('response', (res) => {
      res.resume()
      finish({ upgraded: false, status: res.statusCode })
    })
    req.on('error', (err) => finish({ upgraded: false, error: err.message }))
    req.end()
  })
}

const wsUrl = `${BASE.replace(/^http/, 'ws')}/api/chat/socket`

const authed = await openSocket(wsUrl, cookie, { durationMs: 5000 })
check('authenticated WebSocket upgrade returns 101', authed.upgraded === true, JSON.stringify(authed).slice(0, 200))

const parseFrames = (list) =>
  list.map((raw) => {
    try {
      return JSON.parse(raw)
    } catch {
      return { raw }
    }
  })

if (authed.upgraded) {
  const hello = parseFrames(authed.messages)
  check(
    'server sends a hello frame identifying the user',
    hello.some((m) => m.type === 'hello' && typeof m.userId === 'string'),
    `frames=${JSON.stringify(hello).slice(0, 200)}`,
  )

  const pinged = await openSocket(wsUrl, cookie, {
    send: JSON.stringify({ type: 'ping' }),
    durationMs: 5000,
  })
  check(
    'socket answers ping with pong',
    parseFrames(pinged.messages).some((m) => m.type === 'pong'),
    `frames=${JSON.stringify(parseFrames(pinged.messages)).slice(0, 200)}`,
  )
}

// ── Security ─────────────────────────────────────────────────────────────────
console.log('\nsecurity')
const anon = await openSocket(wsUrl, '', { durationMs: 4000 })
check(
  'unauthenticated WebSocket is refused',
  anon.upgraded === false && anon.status === 401,
  JSON.stringify({ upgraded: anon.upgraded, status: anon.status }).slice(0, 160),
)

const anonUpload = await fetch(`${BASE}/api/upload`, { method: 'POST', body: new FormData() })
check('unauthenticated upload is refused', anonUpload.status === 401, `status=${anonUpload.status}`)

const relay = await fetch(`${BASE}/api/chat/relay`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ kind: 'typing', conversationId: 'x', userId: 'y', typing: true }),
})
check('relay endpoint without the internal secret is refused', relay.status === 401, `status=${relay.status}`)

console.log(`\n${'─'.repeat(60)}`)
console.log(`passed: ${passed}   failed: ${failed}\n`)
process.exit(failed === 0 ? 0 : 1)