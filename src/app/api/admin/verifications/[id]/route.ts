import { requireAdmin } from '@/lib/auth'
import { badRequestError, notFoundError, ok, parseJson, withErrorHandler } from '@/lib/api'
import { first } from '@/lib/db'
import { optNullableText, optTrimmed } from '@/lib/validate'
import { loadProfiles } from '@/lib/data/users'
import { updateVerificationStatus } from '@/lib/data/moderation'

// PATCH /api/admin/verifications/[id]
// Body: { status: 'approved' | 'rejected', note?: string | null }
// Returns { request: { id, user, reason, status, createdAt, note } }
//
// Approving writes `User.verified = 1` and rejecting writes `0`, so rejecting a
// previously approved request actually revokes the badge — the old handler only
// ever wrote `verified = true`.
export const PATCH = withErrorHandler(async (req, ctx) => {
  await requireAdmin()
  const raw = await ctx.params
  const id = Array.isArray(raw.id) ? raw.id[0] : raw.id
  if (!id) throw notFoundError('Permintaan verifikasi tidak ditemukan')

  const body = await parseJson(req)
  // Coerced through the validator: the old code called `.trim()` on a raw body
  // field, which threw a 500 for `null`/numeric bodies.
  const status = optTrimmed(body.status, 'status')
  if (status !== 'approved' && status !== 'rejected') {
    throw badRequestError('status harus salah satu dari: approved, rejected')
  }
  const note = optNullableText(body.note, 'note') ?? null

  const row = await first<{
    id: string
    userId: string
    reason: string
    createdAt: string
  }>(`SELECT id, userId, reason, createdAt FROM Verification WHERE id = ?`, [id])
  if (!row) throw notFoundError('Permintaan verifikasi tidak ditemukan')

  // Throws 404 when the request is gone, and always writes the matching
  // `User.verified` value.
  await updateVerificationStatus(id, status, note)

  // `user` is nullable by design: a request whose user row is missing must not
  // crash the admin view.
  const [profile] = await loadProfiles([row.userId])

  return ok({
    request: {
      id: row.id,
      user: profile ?? null,
      reason: row.reason,
      status,
      note,
      createdAt: row.createdAt,
    },
  })
})