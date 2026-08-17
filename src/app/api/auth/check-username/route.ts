import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser, validateUsername } from '@/lib/auth'
import { ok, withErrorHandler } from '@/lib/api'

export const GET = withErrorHandler(async (req: NextRequest) => {
  const url = new URL(req.url)
  const username = (url.searchParams.get('username') ?? '').trim()

  if (!username) return ok({ available: false, reason: 'empty' })

  const validationErr = validateUsername(username)
  if (validationErr) {
    return ok({ available: false, reason: 'invalid', message: validationErr })
  }

  // SQLite doesn't support Prisma's `mode: 'insensitive'`, so use raw SQL with LOWER()
  const conflicts = await db.$queryRaw<{ id: string }[]>`
    SELECT id FROM User WHERE LOWER(username) = LOWER(${username}) LIMIT 1
  `
  const conflict = conflicts[0]

  if (conflict) {
    // If the conflict is the current user themselves, it's "available" (they own it)
    const currentUser = await getCurrentUser()
    if (currentUser && conflict.id === currentUser.id) {
      return ok({ available: true, reason: 'self' })
    }
    return ok({ available: false, reason: 'taken' })
  }

  return ok({ available: true, reason: 'free' })
})
