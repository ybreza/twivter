import { NextResponse } from 'next/server'
import { ZodError } from 'zod'

// Standard API response helpers
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

// Wrap an async handler so errors are caught uniformly
type Handler = (req: Request, ctx?: any) => Promise<NextResponse>

export function withErrorHandler(handler: Handler): Handler {
  return async (req, ctx) => {
    try {
      return await handler(req, ctx)
    } catch (err: any) {
      if (err?.message === 'UNAUTHORIZED') return unauthorized()
      if (err?.message === 'FORBIDDEN') return forbidden()
      if (err instanceof ZodError) {
        return badRequest('Validation error', err.issues)
      }
      return serverError(err?.message ?? 'Unknown error', err)
    }
  }
}

// Parse JSON body safely
export async function parseJson<T = any>(req: Request): Promise<T> {
  const text = await req.text()
  if (!text) return {} as T
  try {
    return JSON.parse(text) as T
  } catch {
    throw new Error('Invalid JSON body')
  }
}

// ── Count formatters ───────────────────────────
export function formatCount(n: number): string {
  if (n < 1000) return String(n)
  if (n < 1_000_000) {
    const v = n / 1000
    return `${v % 1 === 0 ? v.toFixed(0) : v.toFixed(1)}K`
  }
  const v = n / 1_000_000
  return `${v % 1 === 0 ? v.toFixed(0) : v.toFixed(1)}M`
}

// Relative time
export function timeAgo(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  const now = Date.now()
  const diff = Math.floor((now - d.getTime()) / 1000)
  if (diff < 60) return `${diff}s`
  if (diff < 3600) return `${Math.floor(diff / 60)}m`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`
  if (diff < 604800) return `${Math.floor(diff / 86400)}d`
  // older than a week — show date
  const sameYear = d.getFullYear() === new Date().getFullYear()
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
  })
}
