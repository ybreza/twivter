import {
  createSession,
  hashPassword,
  setSessionCookie,
  validateEmail,
  validatePassword,
  validateUsername,
} from '@/lib/auth'
import { badRequestError, created, parseJson, withErrorHandler } from '@/lib/api'
import { createUser } from '@/lib/data/users'
import { loadCurrentUser } from '@/lib/auth'
import { reqString } from '@/lib/validate'

export const POST = withErrorHandler(async (req) => {
  const body = await parseJson(req)
  const email = reqString(body.email, 'email').trim().toLowerCase()
  const password = reqString(body.password, 'password')
  const username = reqString(body.username, 'username').trim()
  const displayName = (typeof body.displayName === 'string' && body.displayName.trim()) || username

  const emailError = validateEmail(email)
  if (emailError) throw badRequestError(emailError)
  const usernameError = validateUsername(username)
  if (usernameError) throw badRequestError(usernameError)
  const passwordError = validatePassword(password)
  if (passwordError) throw badRequestError(passwordError)
  if (displayName.length > 50) throw badRequestError('Nama tampilan maksimal 50 karakter')

  const passwordHash = await hashPassword(password)
  // Throws 409 when the email or username is already taken.
  const userId = await createUser({ email, passwordHash, username, displayName })

  const token = await createSession(userId)
  await setSessionCookie(token)

  // Build the payload from the row we just created. The old code called
  // `getCurrentUser()` immediately after setting the cookie, which can return
  // null because the cookie is only written to the outgoing response.
  const user = await loadCurrentUser(userId)
  return created({ user })
})