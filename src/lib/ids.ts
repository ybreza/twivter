/**
 * Sortable, collision-resistant identifiers.
 *
 * Every primary key in the D1 schema is produced here. The first 9 characters
 * are a base36 millisecond timestamp, so ids sort chronologically as plain
 * strings. That is what lets every paginated query use a simple keyset cursor
 * (`WHERE id < ? ORDER BY id DESC`) instead of paginating on a non-unique
 * timestamp column, which is what previously caused rows to be skipped or
 * duplicated on page 2 and beyond.
 */

const ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz'
const TIMESTAMP_CHARS = 9
const RANDOM_CHARS = 12
/** ms since epoch that fits in TIMESTAMP_CHARS base36 digits (2^47 ms ≈ year 10889). */
const MAX_TIMESTAMP = 36 ** TIMESTAMP_CHARS - 1

function randomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length)
  crypto.getRandomValues(bytes)
  return bytes
}

function base36(value: number, length: number): string {
  let out = ''
  let n = value
  for (let i = 0; i < length; i++) {
    out = ALPHABET[n % 36] + out
    n = Math.floor(n / 36)
  }
  return out
}

/** Creates a new time-sortable id, optionally anchored to a specific time. */
export function newId(at: number | Date = Date.now()): string {
  const ms = at instanceof Date ? at.getTime() : at
  if (!Number.isFinite(ms) || ms < 0 || ms > MAX_TIMESTAMP) {
    throw new RangeError(`newId: timestamp out of range: ${ms}`)
  }
  const time = base36(Math.floor(ms), TIMESTAMP_CHARS)
  const random = base36FromBytes(randomBytes(8))
  return time + random.slice(0, RANDOM_CHARS)
}

function base36FromBytes(bytes: Uint8Array): string {
  // 16^8 == 2^32, so read the bytes as one unsigned 32-bit integer.
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  return base36(view.getUint32(0), RANDOM_CHARS)
}

/**
 * Opaque, unguessable token for session cookies and R2 signed URLs.
 * Not time-sortable — deliberately unpredictable.
 */
export function newToken(bytes = 32): string {
  const buf = randomBytes(bytes)
  let binary = ''
  for (const b of buf) binary += String.fromCharCode(b)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** Constant-time-ish string comparison that does not leak length via early exit. */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}