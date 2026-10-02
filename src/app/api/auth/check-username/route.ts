import { getCurrentUser } from '@/lib/auth'
import { ok, withErrorHandler } from '@/lib/api'
import { usernameAvailability } from '@/lib/data/users'

export const GET = withErrorHandler(async (req) => {
  const { searchParams } = new URL(req.url)
  const username = (searchParams.get('username') ?? '').trim()
  // Excluding the signed-in user lets them keep their own username while editing.
  const user = await getCurrentUser()
  const result = await usernameAvailability(username, user?.id)
  return ok(result)
})