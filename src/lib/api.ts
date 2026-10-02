import { NextResponse } from 'next/server'
import { ZodError } from 'zod'

// ── Domain errors ────────────────────────────────────────────────────────────
// Route handlers throw these instead of returning ad-hoc responses, so
// `withErrorHandler` can map them to the right status code in one place. Before
// this, every thrown error became a 500 and its raw message (including internal
// SQL details) was returned to the browser.

export class HttpError extends Error {
  readonly status: number
  readonly details?: unknown
  /** Safe to show to the user. */
  readonly expose: boolean

  constructor(status: number, message: string, options?: { details?: unknown; expose?: boolean }) {
    super(message)
    this.name = 'HttpError'
    this.status = status
    this.details = options?.details
    this.expose = options?.expose ?? status < 500
  }
}

export const badRequestError = (message = 'Permintaan tidak valid', details?: unknown) =>
  new HttpError(400, message, { details })

export const unauthorizedError = (message = 'Anda harus masuk terlebih dahulu') =>
  new HttpError(401, message)

export const forbiddenError = (message = 'Anda tidak memiliki akses ke sumber daya ini') =>
  new HttpError(403, message)

export const notFoundError = (message = 'Data tidak ditemukan') => new HttpError(404, message)

export const conflictError = (message = 'Data sudah ada') => new HttpError(409, message)

export const tooLargeError = (message = 'Berkas terlalu besar') => new HttpError(413, message)

/**
 * Raised when a unique index rejects a write. Routes catch this to turn a
 * would-be 500 into a meaningful 409 (duplicate follow, duplicate username, …).
 */
export class UniqueViolationError extends HttpError {
  constructor(message = 'Data sudah ada') {
    super(409, message)
    this.name = 'UniqueViolationError'
  }
}

/** Detects D1's unique-constraint failure. */
export function isUniqueViolation(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err ?? '')
  return /UNIQUE constraint failed|SQLITE_CONSTRAINT_UNIQUE|SQLITE_CONSTRAINT_PRIMARYKEY/i.test(
    message,
  )
}

// ── Response helpers ─────────────────────────────────────────────────────────

export function ok<T>(data: T, status = 200) {
  return NextResponse.json(data, { status })
}

export function created<T>(data: T) {
  return NextResponse.json(data, { status: 201 })
}

export function badRequest(message: string, details?: unknown) {
  return NextResponse.json({ error: message, details }, { status: 400 })
}

export function unauthorized(message = 'Unauthorized') {
  return NextResponse.json({ error: message }, { status: 401 })
}

export function forbidden(message = 'Forbidden') {
  return NextResponse.json({ error: message }, { status: 403 })
}

export function notFound(message = 'Not found') {
  return NextResponse.json({ error: message }, { status: 404 })
}

export function conflict(message: string) {
  return NextResponse.json({ error: message }, { status: 409 })
}

export function serverError(message = 'Internal server error', details?: unknown) {
  console.error('[serverError]', message, details)
  return NextResponse.json({ error: message }, { status: 500 })
}

// ── Handler wrapper ──────────────────────────────────────────────────────────

type RouteContext = { params: Promise<Record<string, string | string[] | undefined>> }

/**
 * Handlers may return a plain `Response` as well as a `NextResponse`: the chat
 * WebSocket endpoint has to return a 101 upgrade, which `NextResponse` cannot
 * express.
 */
type Handler = (req: Request, ctx: RouteContext) => Promise<Response>

export function withErrorHandler(handler: Handler): Handler {
  return async (req, ctx) => {
    try {
      return await handler(req, ctx)
    } catch (err) {
      if (err instanceof HttpError) {
        return NextResponse.json(
          { error: err.message, ...(err.details !== undefined ? { details: err.details } : {}) },
          { status: err.status },
        )
      }
      if (err instanceof ZodError) {
        return badRequest('Validation error', err.issues)
      }
      if (err instanceof SyntaxError || isInvalidJsonError(err)) {
        return badRequest('Body JSON tidak valid')
      }
      if (isUniqueViolation(err)) {
        return conflict('Data sudah ada')
      }
      // Unknown failure: log the real cause, tell the client nothing useful.
      return serverError('Terjadi kesalahan pada server', err)
    }
  }
}

function isInvalidJsonError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err ?? '')
  return /Invalid JSON body|JSON\.parse|Unexpected token|is not valid JSON/i.test(message)
}

/**
 * Parses a JSON request body.
 * Unlike `Request.json()`, this never throws on an empty body and returns a 400
 * (not a 500) for malformed JSON.
 */
export async function parseJson<T = any>(req: Request): Promise<T> {
  const text = await req.text()
  if (!text.trim()) return {} as T
  try {
    return JSON.parse(text) as T
  } catch {
    throw badRequestError('Body JSON tidak valid')
  }
}

// ── Count / time formatting ──────────────────────────────────────────────────

export function formatCount(n: number): string {
  if (!Number.isFinite(n) || n < 0) return '0'
  if (n < 1000) return String(n)
  if (n < 1_000_000) {
    const v = n / 1000
    return `${v % 1 === 0 ? v.toFixed(0) : v.toFixed(1)}K`
  }
  const v = n / 1_000_000
  return `${v % 1 === 0 ? v.toFixed(0) : v.toFixed(1)}M`
}

/** Compact relative time, e.g. `12s`, `4m`, `3h`, `6d`, then an absolute date. */
export function timeAgo(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  if (Number.isNaN(d.getTime())) return ''
  const diff = Math.floor((Date.now() - d.getTime()) / 1000)
  if (diff < 0) return '0s'
  if (diff < 60) return `${diff}s`
  if (diff < 3600) return `${Math.floor(diff / 60)}m`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`
  if (diff < 604800) return `${Math.floor(diff / 86400)}d`
  return d.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    ...(d.getFullYear() === new Date().getFullYear() ? {} : { year: 'numeric' }),
  })
}