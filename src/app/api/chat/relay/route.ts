/**
 * Internal relay for chat side-channel events (typing, read receipts).
 *
 * Called only by the `ChatUser` Durable Object through the
 * `WORKER_SELF_REFERENCE` service binding. Messages themselves do NOT travel
 * this way: they are persisted through `POST /api/conversations/[id]/messages`
 * and pushed from there, so the database stays the single source of truth and a
 * client can never spoof delivery.
 */
import { unauthorizedError, withErrorHandler } from '@/lib/api'
import { assertMember, recipientIds } from '@/lib/data/conversations'
import { pushToUsers } from '@/lib/chat'
import { execute } from '@/lib/db'

export const dynamic = 'force-dynamic'

type RelayBody =
  | { kind: 'typing'; conversationId: string; userId: string; typing: boolean }
  | { kind: 'read'; conversationId: string; userId: string }

/**
 * POST /api/chat/relay
 *
 * Requires `x-twivter-internal` to match `CHAT_INTERNAL_SECRET`. When that
 * secret is unset the endpoint refuses every request rather than defaulting to
 * open, so a misconfigured deploy cannot be abused to fan out arbitrary
 * payloads to arbitrary users.
 */
export const POST = withErrorHandler(async (req) => {
  const secret = process.env.CHAT_INTERNAL_SECRET
  if (!secret) {
    throw unauthorizedError('Relay tidak dikonfigurasi')
  }
  if (req.headers.get('x-twivter-internal') !== secret) {
    throw unauthorizedError()
  }

  const body = (await req.json().catch(() => null)) as RelayBody | null
  if (!body || typeof body !== 'object') throw unauthorizedError()
  const { kind, conversationId, userId } = body
  if (
    (kind !== 'typing' && kind !== 'read') ||
    typeof conversationId !== 'string' ||
    typeof userId !== 'string'
  ) {
    throw unauthorizedError()
  }

  // The object derives `userId` from its own identity, but the conversation
  // membership check is what actually stops cross-conversation spoofing.
  await assertMember(conversationId, userId)

  if (kind === 'read') {
    await execute(
      `UPDATE ConversationMember SET lastReadAt = ? WHERE conversationId = ? AND userId = ?`,
      [new Date().toISOString(), conversationId, userId],
    )
  }

  const event =
    kind === 'typing'
      ? ({ type: 'typing', conversationId, userId, typing: Boolean(body.typing) } as const)
      : ({ type: 'read', conversationId, userId } as const)

  await pushToUsers(await recipientIds(conversationId, userId), event)

  return new Response(null, { status: 204 })
})