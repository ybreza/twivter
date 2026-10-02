import { notFoundError, ok, withErrorHandler } from '@/lib/api'
import { requireUser } from '@/lib/auth'
import { getConversation } from '@/lib/data/conversations'

// GET /api/conversations/[id] — fetch a single conversation.
// Returns { conversation: ConversationDTO }
//
// Membership is checked before the row is read, so a non-member gets 403 for a
// conversation that exists and for one that does not — the endpoint cannot be
// used to probe which ids are real.
export const GET = withErrorHandler(async (req, ctx) => {
  const user = await requireUser()
  const params = await ctx.params
  const raw = params.id
  const conversationId = Array.isArray(raw) ? raw[0] : raw
  if (!conversationId) throw notFoundError('Percakapan tidak ditemukan')

  const conversation = await getConversation(conversationId, user.id)
  return ok({ conversation })
})