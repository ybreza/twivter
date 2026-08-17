import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { requireUser } from '@/lib/auth'
import { ok, badRequest, withErrorHandler, parseJson } from '@/lib/api'

// POST /api/reports — file a report (any logged-in user)
// Body: { targetId, targetType: 'user'|'post', reason }
// Note: the schema's Report.targetId has a FK to User, so we currently
// only persist reports against users. PostCard's report action already
// submits targetType='user' with the post author's id, so this is safe.
export const POST = withErrorHandler(async (req: NextRequest) => {
  const user = await requireUser()
  const body = await parseJson<{
    targetId?: string
    targetType?: string
    reason?: string
  }>(req)

  const targetId = (body.targetId || '').trim()
  const targetType = (body.targetType || 'user').trim()
  const reason = (body.reason || '').trim()

  if (!targetId) return badRequest('targetId wajib diisi')
  if (targetType !== 'user' && targetType !== 'post') {
    return badRequest("targetType harus 'user' atau 'post'")
  }
  if (!reason) return badRequest('Alasan laporan wajib diisi')
  if (reason.length > 500) return badRequest('Alasan maksimal 500 karakter')

  // Prevent self-report
  if (targetId === user.id) return badRequest('Tidak dapat melaporkan diri sendiri')

  // For 'post' targetType the schema still requires targetId to map to a
  // User (FK). We resolve the post's author automatically so the report is
  // attached to a real user row.
  let resolvedTargetId = targetId
  if (targetType === 'post') {
    const post = await db.post.findUnique({
      where: { id: targetId },
      select: { authorId: true },
    })
    if (!post) return badRequest('Post tidak ditemukan')
    resolvedTargetId = post.authorId
  } else {
    // Verify the user exists
    const target = await db.user.findUnique({
      where: { id: targetId },
      select: { id: true },
    })
    if (!target) return badRequest('Pengguna tidak ditemukan')
  }

  // Rate-limit: a user can only file one pending report per target
  const existing = await db.report.findFirst({
    where: { reporterId: user.id, targetId: resolvedTargetId, status: 'pending' },
    select: { id: true },
  })
  if (existing) {
    return badRequest('Kamu sudah melaporkan target ini dan laporan masih ditinjau')
  }

  await db.report.create({
    data: {
      reporterId: user.id,
      targetId: resolvedTargetId,
      targetType,
      reason,
      status: 'pending',
    },
  })

  return ok({ success: true })
})
