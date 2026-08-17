import { db } from '@/lib/db'
import {
  verifyPassword,
  createSessionToken,
  setSessionCookie,
  getCurrentUser,
  validateEmail,
  validatePassword,
} from '@/lib/auth'
import {
  ok,
  badRequest,
  unauthorized,
  serverError,
  withErrorHandler,
  parseJson,
} from '@/lib/api'

export const POST = withErrorHandler(async (req: Request) => {
  const body = await parseJson<{ email?: string; password?: string }>(req)

  const email = (body.email ?? '').trim().toLowerCase()
  const password = body.password ?? ''

  const emailErr = validateEmail(email)
  if (emailErr) return badRequest(emailErr)

  const passwordErr = validatePassword(password)
  if (passwordErr) return badRequest(passwordErr)

  const user = await db.user.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      username: true,
      displayName: true,
      passwordHash: true,
      role: true,
      onboarded: true,
    },
  })

  if (!user) {
    return unauthorized('Email atau password salah')
  }

  const valid = await verifyPassword(password, user.passwordHash)
  if (!valid) {
    return unauthorized('Email atau password salah')
  }

  try {
    const token = await createSessionToken({
      userId: user.id,
      email: user.email,
      username: user.username,
    })
    await setSessionCookie(token)

    const currentUser = await getCurrentUser()
    return ok({ user: currentUser })
  } catch (err: any) {
    return serverError('Gagal membuat sesi', err?.message)
  }
})
