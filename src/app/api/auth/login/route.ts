import { first } from '@/lib/db'
import {
  createSession,
  loadCurrentUser,
  setSessionCookie,
  verifyPassword,
} from '@/lib/auth'
import { ok, parseJson, unauthorizedError, withErrorHandler } from '@/lib/api'
import { reqString } from '@/lib/validate'

interface LoginUserRow {
  id: string
  email: string
  passwordHash: string
}

export const POST = withErrorHandler(async (req) => {
  const body = await parseJson(req)
  const email = reqString(body.email, 'email').trim().toLowerCase()
  const password = reqString(body.password, 'password')

  const row = await first<LoginUserRow>(
    `SELECT id, email, passwordHash FROM User WHERE emailLower = ?`,
    [email],
  )

  // Identical message and roughly identical work for both failure modes, so the
  // endpoint cannot be used to enumerate registered addresses.
  const invalid = unauthorizedError('Email atau password salah')
  if (!row) {
    // Burn a comparable amount of time so timing does not leak existence.
    await verifyPassword(password, '$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinv')
    throw invalid
  }
  if (!(await verifyPassword(password, row.passwordHash))) throw invalid

  const token = await createSession(row.id)
  await setSessionCookie(token)
  const user = await loadCurrentUser(row.id)
  return ok({ user })
})