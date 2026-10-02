import { notFoundError, ok, parseJson, withErrorHandler } from '@/lib/api'
import { requireUser } from '@/lib/auth'
import { all, parseLimit } from '@/lib/db'
import { listMessages, recipientIds, sendMessage } from '@/lib/data/conversations'
import { createNotifications } from '@/lib/data/notifications'
import { pushToUsers } from '@/lib/chat'
import { chunk, inCondition } from '@/lib/sql'
import { toAuthor, type AuthorRow } from '@/lib/serialize'
import { optString } from '@/lib/validate'
import type { AuthorDTO } from '@/lib/types'

/**
 * Resolves the author profile for every distinct sender on a page in one query.
 * The repository returns bare `MessageDTO`s, but the transcript component reads
 * `message.sender` (falling back to the member list only for its own messages).
 */
async function loadSenders(senderIds: string[]): Promise<Map<string, AuthorDTO>> {
  const out = new Map<string, AuthorDTO>()
  for (const group of chunk([...new Set(senderIds.filter(Boolean))])) {
    const where = inCondition('id', group)
    if (!where) continue
    const rows = await all<AuthorRow>(
      `SELECT id, username, displayName, avatarUrl, verified FROM User WHERE ${where.sql}`,
      where.params,
    )
    for (const row of rows) out.set(row.id, toAuthor(row))
  }
  return out
}

// GET /api/conversations/[id]/messages?cursor=<messageId>&limit=50
// Returns { messages: (MessageDTO & { sender })[]; nextCursor: string | null }
//
// The page is fetched newest-first with a keyset on the sortable `id`, then
// reversed so the transcript reads oldest→newest, and `nextCursor` is the id of
// the oldest row on this page.
//
// Two bugs fixed: `limit` went straight to the ORM, so `?limit=0` (and any
// non-numeric value) reached it as `NaN`/`0` and crashed the request — it is now
// clamped by `parseLimit`. And the cursor was fed to `new Date(cursor)`
// unvalidated, so any garbage string threw a 500; the keyset is a plain string
// comparison and cannot throw.
export const GET = withErrorHandler(async (req, ctx) => {
  const user = await requireUser()
  const params = await ctx.params
  const raw = params.id
  const conversationId = Array.isArray(raw) ? raw[0] : raw
  if (!conversationId) throw notFoundError('Percakapan tidak ditemukan')

  const { searchParams } = new URL(req.url)
  const limit = parseLimit(searchParams.get('limit'), 50, 100)
  const cursor = searchParams.get('cursor') || null

  // Throws 403 for a non-member before touching any message row.
  const { messages, nextCursor } = await listMessages(conversationId, user.id, { limit, cursor })

  const senders = await loadSenders(messages.map((m) => m.senderId))
  return ok({
    messages: messages.map((m) => ({ ...m, sender: senders.get(m.senderId) ?? null })),
    nextCursor,
  })
})

// POST /api/conversations/[id]/messages — send a message.
// Body: { content }
// Returns { message: MessageDTO & { sender } }
//
// Also creates one `message` notification per other member. The notifications
// view and the schema both support that type, but nothing ever wrote one, so
// sending a DM was completely silent.
export const POST = withErrorHandler(async (req, ctx) => {
  const user = await requireUser()
  const params = await ctx.params
  const raw = params.id
  const conversationId = Array.isArray(raw) ? raw[0] : raw
  if (!conversationId) throw notFoundError('Percakapan tidak ditemukan')

  const body = await parseJson(req)
  // Coerced, never `.trim()`ed raw: the old `(body.content || '').trim()` threw a
  // 500 whenever `content` was a non-string primitive such as `42`.
  const content = optString(body.content, 'content') ?? ''

  // `sendMessage` enforces membership (403), rejects blank (400), caps the
  // length at 2000 (400) and bumps `Conversation.updatedAt` so the thread floats
  // to the top of the list.
  const message = await sendMessage(conversationId, user.id, content)

  const recipients = await recipientIds(conversationId, user.id)
  await createNotifications(
    recipients.map((userId) => ({ userId, actorId: user.id, type: 'message' })),
  )

  // Realtime delivery. The message is already durable in D1, so a failed push
  // only means "the recipient sees it on their next fetch" — never data loss.
  await pushToUsers(recipients, {
    type: 'message',
    conversationId,
    message: { ...message, sender: user },
    senderId: user.id,
  })

  const senders = await loadSenders([message.senderId])
  return ok({ message: { ...message, sender: senders.get(message.senderId) ?? null } })
})