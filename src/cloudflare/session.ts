/**
 * Session lookup for code that runs **outside** the Next.js request pipeline.
 *
 * `src/lib/auth.ts` uses `cookies()` from `next/headers`, which only exists
 * inside a route handler. The WebSocket upgrade is handled in `worker.ts`
 * before the request ever reaches Next.js, so authentication has to be done
 * here against the raw `Request`.
 */

type D1DatabaseLike = {
  prepare: (query: string) => {
    bind: (...values: unknown[]) => { first: <T>() => Promise<T | null> }
  }
}

export interface SessionUser {
  id: string
  username: string
}

const SESSION_COOKIE = 'twivter_session'

/** Minimal cookie parser — only needs to find one named value. */
export function readCookie(header: string | null, name: string): string | null {
  if (!header) return null
  for (const part of header.split(';')) {
    const eq = part.indexOf('=')
    if (eq === -1) continue
    if (part.slice(0, eq).trim() === name) {
      return decodeURIComponent(part.slice(eq + 1).trim())
    }
  }
  return null
}

/**
 * Resolves the signed-in user for a request.
 *
 * Expired sessions are deleted as a side effect so stale cookies clean
 * themselves up, matching `getCurrentUser()`.
 */
export async function resolveSessionUser(
  request: Request,
  db: D1DatabaseLike,
): Promise<SessionUser | null> {
  const token = readCookie(request.headers.get('cookie'), SESSION_COOKIE)
  if (!token) return null

  const row = await db
    .prepare(
      `SELECT u.id AS id, u.username AS username, s.expiresAt AS expiresAt
         FROM Session s
         JOIN User u ON u.id = s.userId
        WHERE s.token = ?`,
    )
    .bind(token)
    .first<{ id: string; username: string; expiresAt: string }>()

  if (!row) return null
  if (new Date(row.expiresAt).getTime() <= Date.now()) {
    await db.prepare(`DELETE FROM Session WHERE token = ?`).bind(token).first()
    return null
  }
  return { id: row.id, username: row.username }
}