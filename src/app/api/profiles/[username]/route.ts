import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { ok, notFound, withErrorHandler } from '@/lib/api'
import { serializeProfile } from '@/lib/serialize'

// GET /api/profiles/[username] — public profile lookup
export const GET = withErrorHandler(async (req: NextRequest, ctx: { params: Promise<{ username: string }> }) => {
  const { username } = await ctx.params
  const currentUser = await getCurrentUser()

  // SQLite is case-sensitive by default; seed usernames are lowercase.
  // Try exact match first, then fall back to case-insensitive via findMany + filter.
  let user = await db.user.findFirst({ where: { username } })
  if (!user) {
    const lower = username.toLowerCase()
    const candidates = await db.user.findMany({
      where: { username: { contains: lower } },
      take: 50,
    })
    user = candidates.find((u) => u.username.toLowerCase() === lower) ?? null
  }

  if (!user) return notFound('Profil tidak ditemukan')

  const profile = await serializeProfile(user, currentUser?.id ?? null)
  return ok(profile)
})
