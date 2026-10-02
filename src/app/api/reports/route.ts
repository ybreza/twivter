import { requireUser } from '@/lib/auth'
import { badRequestError, ok, parseJson, withErrorHandler } from '@/lib/api'
import { first } from '@/lib/db'
import { reqString } from '@/lib/validate'
import { findUserById } from '@/lib/data/users'
import { createReport } from '@/lib/data/moderation'

// POST /api/reports — file a report (any logged-in user)
// Body: { targetId, targetType: 'user' | 'post', reason }
//
// For `targetType: 'post'`, `targetId` is the *post* id. It is resolved to the
// post's author so the report still attaches to a real user row, but the post id
// is now stored in `Report.targetPostId` as well. The old handler overwrote
// `targetId` with the author id and threw the post away, so moderators could
// never see which post had been reported.
export const POST = withErrorHandler(async (req) => {
  const user = await requireUser()
  const body = await parseJson(req)

  const targetId = reqString(body.targetId, 'targetId')
  const targetType = reqString(body.targetType ?? 'user', 'targetType')
  const reason = reqString(body.reason, 'reason')

  if (targetType !== 'user' && targetType !== 'post') {
    throw badRequestError("targetType harus 'user' atau 'post'")
  }

  // Prevent self-report.
  if (targetId === user.id) throw badRequestError('Tidak dapat melaporkan diri sendiri')

  let targetUserId = targetId
  let targetPostId: string | null = null

  if (targetType === 'post') {
    const post = await first<{ authorId: string }>(
      `SELECT authorId FROM Post WHERE id = ?`,
      [targetId],
    )
    if (!post) throw badRequestError('Post tidak ditemukan')
    targetUserId = post.authorId
    targetPostId = targetId
    if (targetUserId === user.id) throw badRequestError('Tidak dapat melaporkan diri sendiri')
  } else {
    const target = await findUserById(targetId)
    if (!target) throw badRequestError('Pengguna tidak ditemukan')
  }

  // Trims and length-checks the reason, enforces one open report per
  // (reporter, target) with a 409, and writes both target columns.
  await createReport({
    reporterId: user.id,
    targetType,
    targetUserId,
    targetPostId,
    reason,
  })

  return ok({ success: true })
})