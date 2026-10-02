/**
 * Small SQL construction helpers.
 *
 * D1 rejects statements with too many bound parameters, so any `IN (?,?,…)`
 * list is chunked. These helpers keep that logic in one place instead of being
 * re-derived (incorrectly) at each call site.
 */
import type { BindValue } from './db'

/** D1 accepts at most 100 bound parameters per statement. */
export const MAX_BIND_PARAMS = 90

export function placeholders(count: number): string {
  if (count <= 0) return '(NULL)'
  return `(${new Array(count).fill('?').join(', ')})`
}

/** Splits a list into chunks small enough for one statement. */
export function chunk<T>(items: T[], size = MAX_BIND_PARAMS): T[][] {
  if (items.length === 0) return []
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

/**
 * Renders `col IN (…)` for a list of ids, flattening the chunks into one
 * condition (e.g. `col IN (?,?) OR col IN (?,?,?)`). Returns null when empty so
 * callers can skip the condition entirely.
 */
export function inCondition(column: string, ids: readonly string[]): { sql: string; params: BindValue[] } | null {
  if (ids.length === 0) return null
  const parts: string[] = []
  const params: BindValue[] = []
  for (const group of chunk([...ids])) {
    parts.push(`${column} IN ${placeholders(group.length)}`)
    params.push(...group)
  }
  return { sql: parts.join(' OR '), params }
}

/** Builds `col1 = ? AND col2 = ?` from an object, skipping undefined values. */
export function eqAll(
  fields: Record<string, BindValue | undefined>,
): { sql: string; params: BindValue[] } {
  const parts: string[] = []
  const params: BindValue[] = []
  for (const [column, value] of Object.entries(fields)) {
    if (value === undefined) continue
    parts.push(`${column} = ?`)
    params.push(value)
  }
  return { sql: parts.join(' AND '), params }
}

/** Escapes LIKE wildcards so a search for "100%" is a literal search. */
export function likeTerm(raw: string): string {
  return `%${raw.replace(/[\\%_]/g, (c) => `\\${c}`)}%`
}

/** A safe, sortable "sort key" for arbitrary user search input. */
export function sortKey(raw: string): string {
  return raw.trim().slice(0, 100)
}