/**
 * Request-payload coercion helpers.
 *
 * The old handlers guarded fields with `body.x !== undefined`, which lets
 * `null`, numbers and objects through, and then called `.trim()` on them —
 * producing a 500 on inputs as ordinary as `{ "bio": null }`. Everything that
 * comes from a request body is now funnelled through these helpers, which always
 * return the expected primitive type or throw a 400.
 */
import { badRequestError } from './api'

/** Reads an optional string field. `null`/numbers/objects become `undefined`. */
export function optString(value: unknown, field: string): string | undefined {
  if (value === undefined || value === null) return undefined
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  throw badRequestError(`Field "${field}" harus berupa teks`)
}

/** Reads a string field, trimmed. Returns `undefined` when absent/blank-to-clear. */
export function optTrimmed(value: unknown, field: string): string | undefined {
  const raw = optString(value, field)
  if (raw === undefined) return undefined
  const trimmed = raw.trim()
  return trimmed === '' ? undefined : trimmed
}

/** Reads a required string field. */
export function reqString(value: unknown, field: string): string {
  const raw = optString(value, field)
  if (raw === undefined || raw.trim() === '') {
    throw badRequestError(`Field "${field}" wajib diisi`)
  }
  return raw
}

/** Reads an optional trimmed string where blank means "set to NULL". */
export function optNullableText(value: unknown, field: string): string | null | undefined {
  if (value === undefined) return undefined
  if (value === null) return null
  if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean') {
    throw badRequestError(`Field "${field}" harus berupa teks`)
  }
  const trimmed = String(value).trim()
  return trimmed === '' ? null : trimmed
}

/** Reads an optional boolean. Accepts real booleans and the strings "true"/"false". */
export function optBool(value: unknown, field: string): boolean | undefined {
  if (value === undefined || value === null) return undefined
  if (typeof value === 'boolean') return value
  if (value === 'true' || value === '1') return true
  if (value === 'false' || value === '0') return false
  throw badRequestError(`Field "${field}" harus berupa boolean`)
}

/** Reads an optional non-negative integer. */
export function optInt(value: unknown, field: string): number | undefined {
  if (value === undefined || value === null || value === '') return undefined
  const n = typeof value === 'number' ? value : Number.parseInt(String(value), 10)
  if (!Number.isFinite(n) || !Number.isInteger(n)) {
    throw badRequestError(`Field "${field}" harus berupa bilangan bulat`)
  }
  return n
}

/** Reads a list of strings, dropping non-string members and de-duplicating. */
export function optStringArray(value: unknown, field: string, max = 100): string[] | undefined {
  if (value === undefined || value === null) return undefined
  if (!Array.isArray(value)) throw badRequestError(`Field "${field}" harus berupa array`)
  if (value.length > max) throw badRequestError(`Field "${field}" maksimal ${max} item`)
  const out: string[] = []
  const seen = new Set<string>()
  for (const item of value) {
    if (typeof item !== 'string') continue
    const trimmed = item.trim()
    if (!trimmed || seen.has(trimmed)) continue
    seen.add(trimmed)
    out.push(trimmed)
  }
  return out
}

/** Reads a list of ids, enforcing both a count cap and id-shape validation. */
export function optIdArray(value: unknown, field: string, max = 50): string[] | undefined {
  const arr = optStringArray(value, field, max)
  if (arr === undefined) return undefined
  if (arr.length > max) throw badRequestError(`Field "${field}" maksimal ${max} item`)
  for (const id of arr) assertId(id, field)
  return arr
}

/** Rejects anything that is not a plausible opaque id. */
export function assertId(value: unknown, field: string): string {
  const raw = reqString(value, field).trim()
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(raw)) {
    throw badRequestError(`Field "${field}" tidak valid`)
  }
  return raw
}

const SAFE_URL = /^https?:\/\/[^\s]+$/i
/** Same-origin relative path, used for R2 objects served through the Worker. */
const SAFE_PATH = /^\/uploads\/[A-Za-z0-9][A-Za-z0-9/_-]*\.[A-Za-z0-9]{1,8}$/

/**
 * Validates a user-supplied media URL.
 *
 * Accepts absolute http(s) URLs and app-relative `/uploads/...` paths, and
 * rejects `javascript:`, `data:` and other schemes that would be persisted and
 * then rendered into an `<img src>`.
 */
export function assertSafeUrl(value: unknown, field: string): string {
  const raw = reqString(value, field).trim()
  if (SAFE_URL.test(raw)) return raw
  if (SAFE_PATH.test(raw)) return raw
  throw badRequestError(`Field "${field}" bukan URL yang aman`)
}

/** Optional variant of {@link assertSafeUrl}. Blank clears the value. */
export function optSafeUrl(value: unknown, field: string): string | null | undefined {
  if (value === undefined) return undefined
  if (value === null || value === '') return null
  return assertSafeUrl(value, field)
}

/** Enforces a maximum character length on an already-coerced string. */
export function maxLen(value: string, limit: number, field: string): string {
  if (value.length > limit) {
    throw badRequestError(`Field "${field}" maksimal ${limit} karakter`)
  }
  return value
}