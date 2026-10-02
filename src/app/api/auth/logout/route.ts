import { clearSessionCookie, destroySession, getSessionToken } from '@/lib/auth'
import { ok, withErrorHandler } from '@/lib/api'

export const POST = withErrorHandler(async () => {
  const token = await getSessionToken()
  if (token) {
    // Delete the server-side row too. Previously only the cookie was cleared, so
    // a copied token stayed valid for the full 30-day lifetime.
    await destroySession(token)
  }
  await clearSessionCookie()
  return ok({ success: true })
})