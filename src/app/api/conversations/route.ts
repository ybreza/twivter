import { badRequestError, created, ok, parseJson, withErrorHandler } from '@/lib/api'
import { requireUser } from '@/lib/auth'
import { createGroupConversation, listConversations, openPrivateConversation } from '@/lib/data/conversations'
import { assertId, optIdArray, optString, optTrimmed } from '@/lib/validate'

/**
 * A group holds at most 50 members and the creator is always one of them, so a
 * client may name at most 49 others. Before this cap the route happily accepted
 * an unbounded `participantIds` and then inserted one `ConversationMember` row
 * per id.
 */
const MAX_PARTICIPANTS = 49

// GET /api/conversations — the current user's threads, most recently active
// first, with real per-thread unread counts.
// Returns { conversations: ConversationDTO[] }
export const GET = withErrorHandler(async () => {
  const user = await requireUser()
  const conversations = await listConversations(user.id)
  return ok({ conversations })
})

// POST /api/conversations — start a new conversation.
//   Body (private): { participantId }
//   Body (group):   { name, participantIds: string[] }
//
// Returns 201 `{ conversation }` when a thread was actually created and 200
// `{ conversation }` when an existing one was returned, matching the old
// handler's 201/200 split.
export const POST = withErrorHandler(async (req) => {
  const user = await requireUser()
  const body = await parseJson(req)

  // ── Private conversation ─────────────────────────────
  // Coerced through the validator: the old code compared `body.participantId`
  // for truthiness and then handed the raw value to the database, so a numeric
  // or `null` body produced a 500 instead of a 400.
  const participantId = optString(body.participantId, 'participantId')
  if (participantId) {
    const otherId = assertId(participantId, 'participantId')
    // Throws 400 for messaging yourself, 404 for an unknown user, and converges
    // on a single thread thanks to the partial UNIQUE index on `dmKey`.
    const result = await openPrivateConversation(user.id, otherId)
    return result.created
      ? created({ conversation: result.conversation })
      : ok({ conversation: result.conversation })
  }

  // ── Group conversation ───────────────────────────────
  const participantIds = optIdArray(body.participantIds, 'participantIds', MAX_PARTICIPANTS)
  if (participantIds === undefined) {
    throw badRequestError(
      'Body tidak valid — kirim { participantId } atau { name, participantIds }',
    )
  }
  if (participantIds.length === 0) {
    throw badRequestError('Tambahkan minimal satu anggota')
  }

  const name = optTrimmed(body.name, 'name')
  if (name === undefined) throw badRequestError('Nama grup wajib diisi')

  // Enforces the name length, the "at least 3 members" rule, existence of every
  // participant and the 50-member ceiling.
  const conversation = await createGroupConversation(user.id, name, participantIds)
  return created({ conversation })
})