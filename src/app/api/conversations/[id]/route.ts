import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { unauthorized, notFound, forbidden, withErrorHandler, ok } from '@/lib/api'
import { serializeConversation, CONVERSATION_INCLUDE } from '@/lib/serialize'

// GET /api/conversations/[id] — fetch a single conversation (must be a member).
export const GET = withErrorHandler(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const user = await getCurrentUser()
  if (!user) return unauthorized()
  const { id } = await ctx.params

  const conv = await db.conversation.findUnique({
    where: { id },
    include: CONVERSATION_INCLUDE,
  })
  if (!conv) return notFound('Percakapan tidak ditemukan')

  const isMember = conv.members.some((m) => m.userId === user.id)
  if (!isMember) return forbidden('Anda bukan anggota percakapan ini')

  return ok({ conversation: await serializeConversation(conv, user.id) })
})
// touched 1786945215
