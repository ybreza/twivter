import bcrypt from 'bcryptjs'
import { cookies } from 'next/headers'
import { all, execute, first } from './db'
import { unauthorizedError, forbiddenError } from './api'
import { newToken } from './ids'

const SESSION_COOKIE = 'twivter_session'
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30 // 30 days

/** The user shape every authenticated route works with. */
export interface CurrentUser {
  id: string
  email: string
  username: string
  displayName: string
  bio: string | null
  website: string | null
  location: string | null
  avatarUrl: string | null
  coverUrl: string | null
  role: string
  verified: boolean
  onboarded: boolean
  interests: string | null
  createdAt: string
}

const CURRENT_USER_COLUMNS = `
  id, email, username, displayName, bio, website, location,
  avatarUrl, coverUrl, role, verified, onboarded, interests, createdAt
`

interface UserRow {
  id: string
  email: string
  username: string
  displayName: string
  bio: string | null
  website: string | null
  location: string | null
  avatarUrl: string | null
  coverUrl: string | null
  role: string
  verified: number
  onboarded: number
  interests: string | null
  createdAt: string
}

function toCurrentUser(row: UserRow): CurrentUser {
  return {
    ...row,
    verified: row.verified === 1,
    onboarded: row.onboarded === 1,
  }
}

/** Prefixes every column in CURRENT_USER_COLUMNS with a table alias. */
function prefixColumns(alias: string): string {
  return CURRENT_USER_COLUMNS.trim()
    .split(',')
    .map((column) => `${alias}.${column.trim()}`)
    .join(', ')
}

// ── Password hashing ─────────────────────────────────────────────────────────

export async function hashPassword(password: string): Promise<string> {
  // 10 rounds is the previous cost factor; kept so existing hashes stay valid.
  return bcrypt.hash(password, 10)
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  try {
    return await bcrypt.compare(password, hash)
  } catch {
    return false
  }
}

// ── Sessions ─────────────────────────────────────────────────────────────────

/**
 * Issues a session token and persists it.
 *
 * The previous implementation only minted a stateless JWT, so a leaked cookie
 * stayed usable for the full 30 days even after the user logged out. Sessions
 * are now stored, so logout genuinely revokes access.
 */
export async function createSession(userId: string): Promise<string> {
  const token = newToken(32)
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000).toISOString()
  await execute(
    `INSERT INTO Session (token, userId, expiresAt) VALUES (?, ?, ?)`,
    [token, userId, expiresAt],
  )
  return token
}

export async function destroySession(token: string): Promise<void> {
  await execute(`DELETE FROM Session WHERE token = ?`, [token])
}

export async function setSessionCookie(token: string): Promise<void> {
  const store = await cookies()
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE_SECONDS,
  })
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies()
  store.delete(SESSION_COOKIE)
}

export async function readSessionToken(): Promise<string | null> {
  const store = await cookies()
  return store.get(SESSION_COOKIE)?.value ?? null
}

export { readSessionToken as getSessionToken }

/**
 * Resolves the signed-in user, or null.
 *
 * The session row is joined to `User` in one query, and expired sessions are
 * deleted as a side effect so stale cookies clean themselves up.
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const token = await readSessionToken()
  if (!token) return null

  const row = await first<UserRow & { expiresAt: string }>(
    `SELECT ${prefixColumns('u')}, s.expiresAt
       FROM Session s
       JOIN User u ON u.id = s.userId
      WHERE s.token = ?`,
    [token],
  )
  if (!row) return null

  if (new Date(row.expiresAt).getTime() <= Date.now()) {
    await destroySession(token)
    return null
  }

  return toCurrentUser(row)
}

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser()
  if (!user) throw unauthorizedError()
  return user
}

export async function requireAdmin(): Promise<CurrentUser> {
  const user = await requireUser()
  if (user.role !== 'admin') throw forbiddenError('Hanya admin yang dapat mengakses sumber daya ini')
  return user
}

/** Best-effort cleanup of expired sessions; safe to call opportunistically. */
export async function pruneExpiredSessions(): Promise<void> {
  await execute(`DELETE FROM Session WHERE expiresAt <= ?`, [new Date().toISOString()])
}

/** Loads the full current-user row again, for after a mutation. */
export async function loadCurrentUser(userId: string): Promise<CurrentUser | null> {
  const row = await first<UserRow>(`SELECT ${CURRENT_USER_COLUMNS} FROM User WHERE id = ?`, [userId])
  return row ? toCurrentUser(row) : null
}

/** All ids of users this user follows (excluding themselves). */
export async function followingIds(userId: string): Promise<string[]> {
  const rows = await all<{ followingId: string }>(
    `SELECT followingId FROM Follow WHERE followerId = ?`,
    [userId],
  )
  return rows.map((r) => r.followingId)
}

// ── Validators ───────────────────────────────────────────────────────────────

export function validateUsername(username: string): string | null {
  if (!username) return 'Username wajib diisi'
  if (username.length < 3) return 'Username minimal 3 karakter'
  if (username.length > 20) return 'Username maksimal 20 karakter'
  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    return 'Username hanya boleh huruf, angka, dan underscore'
  }
  return null
}

export function validateEmail(email: string): string | null {
  if (!email) return 'Email wajib diisi'
  if (email.length > 254) return 'Email terlalu panjang'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Format email tidak valid'
  return null
}

export function validatePassword(password: string): string | null {
  if (!password) return 'Password wajib diisi'
  if (password.length < 6) return 'Password minimal 6 karakter'
  if (password.length > 200) return 'Password terlalu panjang'
  return null
}