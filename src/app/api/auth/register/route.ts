import { db } from '@/lib/db'
import {
  hashPassword,
  createSessionToken,
  setSessionCookie,
  getCurrentUser,
  validateUsername,
  validateEmail,
  validatePassword,
} from '@/lib/auth'
import {
  created,
  badRequest,
  conflict,
  serverError,
  withErrorHandler,
  parseJson,
} from '@/lib/api'

export const POST = withErrorHandler(async (req: Request) => {
  const body = await parseJson<{
    email?: string
    password?: string
    username?: string
    displayName?: string
  }>(req)

  const email = (body.email ?? '').trim().toLowerCase()
  const password = body.password ?? ''
  const username = (body.username ?? '').trim()
  const displayName = (body.displayName ?? '').trim()

  // Validate inputs
  const emailErr = validateEmail(email)
  if (emailErr) return badRequest(emailErr)

  const passwordErr = validatePassword(password)
  if (passwordErr) return badRequest(passwordErr)

  const usernameErr = validateUsername(username)
  if (usernameErr) return badRequest(usernameErr)

  if (!displayName || displayName.length < 1) {
    return badRequest('Nama tampilan wajib diisi')
  }
  if (displayName.length > 50) {
    return badRequest('Nama tampilan maksimal 50 karakter')
  }

  // Case-insensitive username check (SQLite: use raw SQL with LOWER())
  const conflicts = await db.$queryRaw<{ id: string; email: string }[]>`
    SELECT id, email FROM User
    WHERE LOWER(email) = LOWER(${email})
       OR LOWER(username) = LOWER(${username})
    LIMIT 1
  `
  const existing = conflicts[0]

  if (existing) {
    if (existing.email.toLowerCase() === email) {
      return conflict('Email sudah digunakan')
    }
    return conflict('Username sudah digunakan')
  }

  try {
    const passwordHash = await hashPassword(password)
    const user = await db.user.create({
      data: {
        email,
        passwordHash,
        username,
        displayName,
        role: 'user',
        onboarded: false,
      },
    })

    const token = await createSessionToken({
      userId: user.id,
      email: user.email,
      username: user.username,
    })
    await setSessionCookie(token)

    const currentUser = await getCurrentUser()
    return created({ user: currentUser })
  } catch (err: any) {
    if (err?.code === 'P2002') {
      return conflict('Email atau username sudah digunakan')
    }
    return serverError('Gagal membuat akun', err?.message)
  }
})
