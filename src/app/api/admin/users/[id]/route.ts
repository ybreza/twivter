import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'
import { ok, badRequest, notFound, withErrorHandler, parseJson } from '@/lib/api'
import { serializeProfile } from '@/lib/serialize'

// PATCH /api/admin/users/[id]
// Body: { role?: 'user'|'admin', verified?: boolean }
// Returns the updated ProfileDTO.
export const PATCH = withErrorHandler(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const admin = await requireAdmin()
  const { id } = await ctx.params
  if (!id) return notFound('Pengguna tidak ditemukan')

  const body = await parseJson<{ role?: string; verified?: boolean }>(req)

  const updates: Record<string, unknown> = {}

  if (body.role !== undefined) {
    if (body.role !== 'user' && body.role !== 'admin') {
      return badRequest('role harus salah satu dari: user, admin')
    }
    // Safety: prevent admin from demoting themselves (would lock themselves out)
    if (body.role !== 'admin' && id === admin.id) {
      return badRequest('Kamu tidak dapat menurunkan role-mu sendiri')
    }
    updates.role = body.role
  }

  if (body.verified !== undefined) {
    updates.verified = !!body.verified
  }

  if (Object.keys(updates).length === 0) {
    return badRequest('Tidak ada perubahan untuk disimpan')
  }

  const existing = await db.user.findUnique({ where: { id }, select: { id: true } })
  if (!existing) return notFound('Pengguna tidak ditemukan')

  const updated = await db.user.update({
    where: { id },
    data: updates,
  })

  const profile = await serializeProfile(updated, admin.id)
  return ok(profile)
})
