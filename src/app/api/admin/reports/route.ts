import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'
import { ok, withErrorHandler } from '@/lib/api'
import type { AuthorDTO } from '@/lib/types'

interface AdminReportDTO {
  id: string
  reporter: AuthorDTO
  target: AuthorDTO
  targetType: string
  reason: string
  status: string
  createdAt: string
}

const REPORT_INCLUDE = {
  reporter: {
    select: {
      id: true,
      username: true,
      displayName: true,
      avatarUrl: true,
      verified: true,
    },
  },
  target: {
    select: {
      id: true,
      username: true,
      displayName: true,
      avatarUrl: true,
      verified: true,
    },
  },
} as const

// GET /api/admin/reports?status=pending|reviewed|resolved|dismissed&cursor=<id>
// Returns { reports: AdminReportDTO[], nextCursor: string | null }
export const GET = withErrorHandler(async (req: NextRequest) => {
  await requireAdmin()
  const { searchParams } = new URL(req.url)
  const statusParam = searchParams.get('status') // null = all
  const cursor = searchParams.get('cursor')
  const limit = 50

  const validStatuses = ['pending', 'reviewed', 'resolved', 'dismissed']
  const where: any = statusParam && validStatuses.includes(statusParam)
    ? { status: statusParam }
    : undefined

  const reports = await db.report.findMany({
    where,
    include: REPORT_INCLUDE,
    orderBy: { createdAt: 'desc' },
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  })

  const hasMore = reports.length > limit
  const items = hasMore ? reports.slice(0, limit) : reports
  const serialized: AdminReportDTO[] = items.map((r: any) => ({
    id: r.id,
    reporter: r.reporter,
    target: r.target,
    targetType: r.targetType,
    reason: r.reason,
    status: r.status,
    createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : r.createdAt,
  }))

  return ok({
    reports: serialized,
    nextCursor: hasMore ? items[items.length - 1].id : null,
  })
})
