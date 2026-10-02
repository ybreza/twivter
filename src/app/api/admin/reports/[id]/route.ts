import { requireAdmin } from '@/lib/auth'
import { badRequestError, notFoundError, ok, parseJson, withErrorHandler } from '@/lib/api'
import { optTrimmed } from '@/lib/validate'
import { updateReportStatus, type ReportStatus } from '@/lib/data/moderation'

const ALLOWED: readonly ReportStatus[] = ['reviewed', 'resolved', 'dismissed']

// PATCH /api/admin/reports/[id] — update report status
// Body: { status: 'reviewed' | 'resolved' | 'dismissed' }
// Returns the updated AdminReport under `report`.
export const PATCH = withErrorHandler(async (req, ctx) => {
  await requireAdmin()
  const raw = await ctx.params
  const id = Array.isArray(raw.id) ? raw.id[0] : raw.id
  if (!id) throw notFoundError('Laporan tidak ditemukan')

  const body = await parseJson(req)
  // Coerced through the validator: the old code called `.trim()` on a raw body
  // field, which threw a 500 for `null`/numeric bodies.
  const status = optTrimmed(body.status, 'status')
  if (!status || !ALLOWED.includes(status as ReportStatus)) {
    throw badRequestError('status harus salah satu dari: reviewed, resolved, dismissed')
  }

  // Throws 404 when the report does not exist.
  const report = await updateReportStatus(id, status as ReportStatus)

  return ok({ report })
})