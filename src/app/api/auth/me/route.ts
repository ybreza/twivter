import { getCurrentUser, loadCurrentUser } from '@/lib/auth'
import { ok, withErrorHandler } from '@/lib/api'

export const GET = withErrorHandler(async () => {
  const user = await getCurrentUser()
  if (!user) return ok({ user: null })
  // Re-read so fields added by a profile update in the same session are fresh.
  const fresh = (await loadCurrentUser(user.id)) ?? user
  return ok({ user: fresh })
})