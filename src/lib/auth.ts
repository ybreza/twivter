import bcrypt from 'bcryptjs'
import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'
import { db } from './db'

const SESSION_COOKIE = 'twivter_session'
const SESSION_SECRET = new TextEncoder().encode(
  process.env.SESSION_SECRET || 'twivter-dev-secret-change-in-production-please'
)
const SESSION_MAX_AGE = 60 * 60 * 24 * 30 // 30 days

export interface SessionPayload {
  userId: string
  email: string
  username: string
}

// ── Password hashing ──────────────────────────
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10)
}

export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

// ── JWT session ───────────────────────────────
export async function createSessionToken(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE}s`)
    .sign(SESSION_SECRET)
}

export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, SESSION_SECRET)
    return payload as unknown as SessionPayload
  } catch {
    return null
  }
}

// ── Cookie helpers (server-side) ──────────────
export async function setSessionCookie(token: string) {
  const store = await cookies()
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE,
  })
}

export async function clearSessionCookie() {
  const store = await cookies()
  store.delete(SESSION_COOKIE)
}

export async function getSessionToken(): Promise<string | undefined> {
  const store = await cookies()
  return store.get(SESSION_COOKIE)?.value
}

// ── Current user helper ───────────────────────
export async function getCurrentUser() {
  const token = await getSessionToken()
  if (!token) return null
  const payload = await verifySessionToken(token)
  if (!payload) return null
  const user = await db.user.findUnique({
    where: { id: payload.userId },
    select: {
      id: true,
      email: true,
      username: true,
      displayName: true,
      bio: true,
      website: true,
      location: true,
      avatarUrl: true,
      coverUrl: true,
      role: true,
      verified: true,
      onboarded: true,
      interests: true,
      createdAt: true,
    },
  })
  return user
}

export async function requireUser() {
  const user = await getCurrentUser()
  if (!user) {
    throw new Error('UNAUTHORIZED')
  }
  return user
}

export async function requireAdmin() {
  const user = await requireUser()
  if (user.role !== 'admin') {
    throw new Error('FORBIDDEN')
  }
  return user
}

// ── Username validation ───────────────────────
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
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return 'Format email tidak valid'
  }
  return null
}

export function validatePassword(password: string): string | null {
  if (!password) return 'Password wajib diisi'
  if (password.length < 6) return 'Password minimal 6 karakter'
  return null
}
