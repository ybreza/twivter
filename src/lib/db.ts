/**
 * Cloudflare D1 access layer.
 *
 * Replaces the previous Prisma client. Everything the app does against the
 * database goes through the small set of helpers below, so there is exactly one
 * place that knows how to reach a D1 binding.
 */
import { getCloudflareContext } from '@opennextjs/cloudflare'

type D1DatabaseLike = {
  prepare: (query: string) => D1PreparedStatementLike
  batch: (statements: D1PreparedStatementLike[]) => Promise<D1ResultLike[]>
}

type D1PreparedStatementLike = {
  bind: (...values: unknown[]) => D1PreparedStatementLike
  first: <T = Record<string, unknown>>(colName?: string) => Promise<T | null>
  all: <T = Record<string, unknown>>() => Promise<{ results: T[]; success: boolean; meta?: unknown }>
  run: () => Promise<D1ResultLike>
}

type D1ResultLike = {
  success: boolean
  meta?: { changes?: number; last_row_id?: number; rows_read?: number; rows_written?: number }
  results?: Record<string, unknown>[]
}

export type BindValue = string | number | null | ArrayBuffer | Uint8Array

/** Resolves the D1 binding declared in wrangler.jsonc. */
export async function d1(): Promise<D1DatabaseLike> {
  const { env } = await getCloudflareContext({ async: true })
  const database = (env as Record<string, unknown> | undefined)?.DB as D1DatabaseLike | undefined
  if (!database) {
    throw new Error(
      'D1 binding "DB" tidak ditemukan. Jalankan `wrangler d1 create twivter-db` lalu perbarui ' +
        'database_id di wrangler.jsonc, atau pakai `wrangler dev` untuk mode lokal.',
    )
  }
  return database
}

let cached: Promise<D1DatabaseLike> | null = null

/** Same as {@link d1} but memoised per request/isolate. */
export function getDb(): Promise<D1DatabaseLike> {
  if (!cached) cached = d1()
  return cached
}

/**
 * Resets the memoised binding. Workers reuse the module scope between requests,
 * so this must be called whenever the context changes (tests, dev hot reload).
 */
export function resetDbCache(): void {
  cached = null
}

/**
 * Wraps a failing statement with its SQL so the log identifies which query
 * broke. D1's own error only says `no such column: x`, which is close to
 * useless when a helper builds the condition.
 */
async function withSql<T>(sql: string, operation: () => Promise<T>): Promise<T> {
  try {
    return await operation()
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err)
    console.error(`[db] ${detail}\n[db] SQL: ${sql}`)
    throw err
  }
}

/** Runs a SELECT and returns every row. */
export async function all<T = Record<string, unknown>>(
  sql: string,
  params: BindValue[] = [],
): Promise<T[]> {
  const db = await getDb()
  return withSql(sql, async () => {
    const { results } = await db.prepare(sql).bind(...params).all<T>()
    return results ?? []
  })
}

/** Runs a SELECT and returns the first row, or null. */
export async function first<T = Record<string, unknown>>(
  sql: string,
  params: BindValue[] = [],
): Promise<T | null> {
  const db = await getDb()
  return withSql(sql, async () => db.prepare(sql).bind(...params).first<T>())
}

/** Reads a single scalar from the first row (e.g. `COUNT(*)`). */
export async function scalar<T = number>(
  sql: string,
  params: BindValue[] = [],
  fallback?: T,
): Promise<T> {
  const row = await first<Record<string, T>>(sql, params)
  if (!row) return fallback as T
  const values = Object.values(row)
  return (values.length ? values[0] : fallback) as T
}

/** Runs an INSERT/UPDATE/DELETE and returns the number of affected rows. */
export async function execute(
  sql: string,
  params: BindValue[] = [],
): Promise<number> {
  const db = await getDb()
  return withSql(sql, async () => {
    const result = await db.prepare(sql).bind(...params).run()
    return result.meta?.changes ?? 0
  })
}

/** Runs a batch of statements atomically in one round-trip. */
export async function batch(statements: { sql: string; params?: BindValue[] }[]): Promise<void> {
  if (statements.length === 0) return
  const db = await getDb()
  const prepared = statements.map((s) => db.prepare(s.sql).bind(...(s.params ?? [])))
  await db.batch(prepared)
}

/**
 * Builds a `keyset` pagination window.
 *
 * The old code used `cursor: { id }` combined with `orderBy: { createdAt }`.
 * `createdAt` is not unique, so rows sharing a timestamp were skipped or repeated
 * across pages. Ids are time-sortable (see `src/lib/ids.ts`), so ordering and
 * paginating on `id` alone is both correct and index-friendly.
 */
export function keyset<T extends Record<string, unknown>>(
  row: T | null | undefined,
  limit: number,
): { id: string } | null {
  if (!row) return null
  return { id: String(row.id) }
}

/** Clamps a `?limit=` query parameter into a sane range. */
export function parseLimit(raw: string | null, fallback = 20, max = 50): number {
  if (raw === null || raw.trim() === '') return fallback
  const n = Number.parseInt(raw, 10)
  if (!Number.isFinite(n)) return fallback
  if (n < 1) return 1
  if (n > max) return max
  return n
}

/** Normalises SQLite's 0/1 into a real boolean. */
export function toBool(value: unknown): boolean {
  return value === 1 || value === true || value === '1'
}

/** Normalises a real boolean into SQLite's 0/1. */
export function fromBool(value: boolean | undefined | null): number {
  return value ? 1 : 0
}