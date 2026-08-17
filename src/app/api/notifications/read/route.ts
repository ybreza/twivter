import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { requireUser } from '@/lib/auth'
import { ok, badRequest, withErrorHandler, parseJson } from '@/lib/api'

// POST /api/notifications/read
// Body: { id?: string } — if id provided, mark that one read; else mark all read.
export const POST = withErrorHandler(async (req: NextRequest) => {
  const user = await requireUser()
  const body = await parseJson<{ id?: string }>(req)

  if (body.id) {
    // Verify ownership before updating
    const notif = await db.notification.findUnique({
      where: { id: body.id },
      select: { userId: true },
    })
    if (!notif) return badRequest('Notifikasi tidak ditemukan')
    if (notif.userId !== user.id) return badRequest('Tidak diizinkan')
    await db.notification.update({
      where: { id: body.id },
      data: { read: true },
    })
  } else {
    await db.notification.updateMany({
      where: { userId: user.id, read: false },
      data: { read: true },
    })
  }

  return ok({ success: true })
})
