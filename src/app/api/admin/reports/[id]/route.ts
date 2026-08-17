import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'
import { ok, badRequest, notFound, withErrorHandler, parseJson } from '@/lib/api'

// PATCH /api/admin/reports/[id] — update report status
// Body: { status: 'reviewed' | 'resolved' | 'dismissed' }
export const PATCH = withErrorHandler(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  await requireAdmin()
  const { id } = await ctx.params
  if (!id) return notFound('Laporan tidak ditemukan')

  const body = await parseJson<{ status?: string }>(req)
  const status = (body.status || '').trim()
  const allowed = ['reviewed', 'resolved', 'dismissed']
  if (!allowed.includes(status)) {
    return badRequest('status harus salah satu dari: reviewed, resolved, dismissed')
  }

  const existing = await db.report.findUnique({ where: { id }, select: { id: true } })
  if (!existing) return notFound('Laporan tidak ditemukan')

  const updated = await db.report.update({
    where: { id },
    data: { status },
    include: {
      reporter: {
        select: { id: true, username: true, displayName: true, avatarUrl: true, verified: true },
      },
      target: {
        select: { id: true, username: true, displayName: true, avatarUrl: true, verified: true },
      },
    },
  })

  return ok({
    report: {
      id: updated.id,
      reporter: updated.reporter,
      target: updated.target,
      targetType: updated.targetType,
      reason: updated.reason,
      status: updated.status,
      createdAt: updated.createdAt instanceof Date ? updated.createdAt.toISOString() : updated.createdAt,
    },
  })
})
