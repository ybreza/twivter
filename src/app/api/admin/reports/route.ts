import { requireAdmin } from '@/lib/auth'
import { ok, withErrorHandler } from '@/lib/api'
import { listReports, REPORT_STATUSES, type ReportStatus } from '@/lib/data/moderation'

const REPORT_STATUS_SET: readonly string[] = REPORT_STATUSES

function parseStatus(raw: string | null): ReportStatus | 'all' {
  if (raw && REPORT_STATUS_SET.includes(raw)) return raw as ReportStatus
  return 'all'
}

// GET /api/admin/reports?status=pending|reviewed|resolved|dismissed&limit=&cursor=<id>
// Returns { reports: AdminReport[], nextCursor: string | null }
//
// `AdminReport` carries `targetPost` as well as `target`, so a moderator can see
// which post a report was filed against — the old handler resolved the post to
// its author and threw the post id away.
export const GET = withErrorHandler(async (req) => {
  await requireAdmin()
  const { searchParams } = new URL(req.url)

  const { reports, nextCursor } = await listReports({
    status: parseStatus(searchParams.get('status')),
    limit: 50,
    cursor: searchParams.get('cursor'),
  })

  return ok({ reports, nextCursor })
})