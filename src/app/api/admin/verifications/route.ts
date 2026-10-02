import { requireAdmin } from '@/lib/auth'
import { ok, withErrorHandler } from '@/lib/api'
import { listVerifications, VERIFICATION_STATUSES, type VerificationStatus } from '@/lib/data/moderation'

const VERIFICATION_STATUS_SET: readonly string[] = VERIFICATION_STATUSES

function parseStatus(raw: string | null): VerificationStatus | 'all' {
  if (raw && VERIFICATION_STATUS_SET.includes(raw)) return raw as VerificationStatus
  return 'all'
}

// GET /api/admin/verifications?status=pending|approved|rejected&cursor=<id>
// Returns { requests: AdminVerification[], nextCursor: string | null }
//
// `user` is `ProfileDTO | null` — a request whose user row is gone stays in the
// queue instead of silently vanishing, and the admin view must not assume it is
// present.
export const GET = withErrorHandler(async (req) => {
  await requireAdmin()
  const { searchParams } = new URL(req.url)

  const { requests, nextCursor } = await listVerifications({
    status: parseStatus(searchParams.get('status')),
    limit: 50,
    cursor: searchParams.get('cursor'),
  })

  return ok({ requests, nextCursor })
})