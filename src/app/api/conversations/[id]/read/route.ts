import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { requireUser } from '@/lib/auth'
import { forbidden, notFound, withErrorHandler, ok } from '@/lib/api'

// POST /api/conversations/[id]/read — mark all messages in the conversation as
// read by the current user (updates `ConversationMember.lastReadAt`).
export const POST = withErrorHandler(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireUser()
  const { id } = await ctx.params

  const membership = await db.conversationMember.findUnique({
    where: { conversationId_userId: { conversationId: id, userId: user.id } },
    select: { id: true },
  })
  if (!membership) return forbidden('Anda bukan anggota percakapan ini')

  const conv = await db.conversation.findUnique({ where: { id }, select: { id: true } })
  if (!conv) return notFound('Percakapan tidak ditemukan')

  await db.conversationMember.update({
    where: { conversationId_userId: { conversationId: id, userId: user.id } },
    data: { lastReadAt: new Date() },
  })

  return ok({ success: true })
})
// touched 1786945215
