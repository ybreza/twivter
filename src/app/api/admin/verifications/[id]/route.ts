import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'
import { ok, badRequest, notFound, withErrorHandler, parseJson } from '@/lib/api'
import { serializeProfile } from '@/lib/serialize'

// PATCH /api/admin/verifications/[id]
// Body: { status: 'approved' | 'rejected' }
// If approved: set the requesting user's `verified = true`.
//
// Note: the Verification model has no `user` relation (just a `userId`
// string field), so we fetch the user separately.
export const PATCH = withErrorHandler(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const admin = await requireAdmin()
  const { id } = await ctx.params
  if (!id) return notFound('Permintaan verifikasi tidak ditemukan')

  const body = await parseJson<{ status?: string }>(req)
  const status = (body.status || '').trim()
  if (status !== 'approved' && status !== 'rejected') {
    return badRequest('status harus salah satu dari: approved, rejected')
  }

  const existing = await db.verification.findUnique({ where: { id } })
  if (!existing) return notFound('Permintaan verifikasi tidak ditemukan')

  const existingUser = await db.user.findUnique({ where: { id: existing.userId } })
  if (!existingUser) return notFound('Pengguna peminta tidak ditemukan')

  // Update verification status
  const updated = await db.verification.update({
    where: { id },
    data: { status },
  })

  // If approved, mark the user as verified
  let userRow = existingUser
  if (status === 'approved') {
    userRow = await db.user.update({
      where: { id: existing.userId },
      data: { verified: true },
    })
  }

  const profile = await serializeProfile(userRow, admin.id)

  return ok({
    request: {
      id: updated.id,
      user: profile,
      reason: updated.reason,
      status: updated.status,
      createdAt: updated.createdAt instanceof Date ? updated.createdAt.toISOString() : updated.createdAt,
    },
  })
})
