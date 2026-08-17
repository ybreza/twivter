import { getCurrentUser } from '@/lib/auth'
import { ok, unauthorized } from '@/lib/api'
import { withErrorHandler } from '@/lib/api'

export const GET = withErrorHandler(async () => {
  const user = await getCurrentUser()
  if (!user) return unauthorized()
  return ok({ user })
})
