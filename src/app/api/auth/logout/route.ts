import { revalidatePath } from 'next/cache'
import { getCurrentUser, clearSessionCookie } from '@/lib/auth'
import { ok, unauthorized } from '@/lib/api'
import { withErrorHandler } from '@/lib/api'

export const POST = withErrorHandler(async () => {
  const user = await getCurrentUser()
  if (!user) return unauthorized()
  await clearSessionCookie()
  revalidatePath('/')
  return ok({ success: true })
})
