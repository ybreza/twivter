import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { requireUser, validateUsername } from '@/lib/auth'
import {
  ok,
  badRequest,
  unauthorized,
  conflict,
  withErrorHandler,
  parseJson,
} from '@/lib/api'
import { serializeProfile } from '@/lib/serialize'

// GET /api/profiles/me — current user's profile (auth required)
export const GET = withErrorHandler(async () => {
  const user = await requireUser()
  const profile = await serializeProfile(user, user.id)
  return ok(profile)
})

// PATCH /api/profiles/me — update current user profile
export const PATCH = withErrorHandler(async (req: NextRequest) => {
  const user = await requireUser()
  const body = await parseJson<{
    displayName?: string
    username?: string
    bio?: string
    website?: string
    location?: string
    avatarUrl?: string
    coverUrl?: string
  }>(req)

  const updates: Record<string, unknown> = {}

  if (body.displayName !== undefined) {
    const dn = body.displayName.trim()
    if (!dn) return badRequest('Nama tampilan tidak boleh kosong')
    if (dn.length > 50) return badRequest('Nama tampilan maksimal 50 karakter')
    updates.displayName = dn
  }

  if (body.username !== undefined) {
    const un = body.username.trim()
    const verr = validateUsername(un)
    if (verr) return badRequest(verr)
    // uniqueness check (exclude self)
    const existing = await db.user.findFirst({
      where: { username: un, NOT: { id: user.id } },
    })
    if (existing) return conflict('Username sudah digunakan')
    updates.username = un
  }

  if (body.bio !== undefined) {
    const bio = body.bio.trim()
    if (bio.length > 160) return badRequest('Bio maksimal 160 karakter')
    updates.bio = bio || null
  }

  if (body.website !== undefined) {
    const website = body.website.trim()
    if (website && !/^https?:\/\/.+/i.test(website)) {
      return badRequest('Website harus diawali http:// atau https://')
    }
    updates.website = website || null
  }

  if (body.location !== undefined) {
    const loc = body.location.trim()
    if (loc.length > 60) return badRequest('Lokasi maksimal 60 karakter')
    updates.location = loc || null
  }

  if (body.avatarUrl !== undefined) {
    updates.avatarUrl = body.avatarUrl || null
  }
  if (body.coverUrl !== undefined) {
    updates.coverUrl = body.coverUrl || null
  }

  if (Object.keys(updates).length === 0) {
    return badRequest('Tidak ada perubahan untuk disimpan')
  }

  const updated = await db.user.update({
    where: { id: user.id },
    data: updates,
  })

  const profile = await serializeProfile(updated, updated.id)
  return ok(profile)
})
