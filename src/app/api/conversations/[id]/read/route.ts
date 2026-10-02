import { notFoundError, ok, withErrorHandler } from '@/lib/api'
import { requireUser } from '@/lib/auth'
import { markConversationRead } from '@/lib/data/conversations'

// POST /api/conversations/[id]/read — mark every message in the conversation as
// read for the current user (updates `ConversationMember.lastReadAt`, which is
// also what the unread badge aggregates on).
// Returns { success: true }
//
// The old handler looked the membership up twice — once to 403, once to update —
// and only then checked that the conversation existed.
export const POST = withErrorHandler(async (req, ctx) => {
  const user = await requireUser()
  const params = await ctx.params
  const raw = params.id
  const conversationId = Array.isArray(raw) ? raw[0] : raw
  if (!conversationId) throw notFoundError('Percakapan tidak ditemukan')

  // Throws 403 for a non-member; updates in a single statement.
  await markConversationRead(conversationId, user.id)

  return ok({ success: true })
})