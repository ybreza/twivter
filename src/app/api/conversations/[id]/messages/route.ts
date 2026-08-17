import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser, requireUser } from '@/lib/auth'
import {
  unauthorized,
  notFound,
  forbidden,
  badRequest,
  withErrorHandler,
  ok,
  parseJson,
} from '@/lib/api'
import { serializeMessage } from '@/lib/serialize'

// GET /api/conversations/[id]/messages?cursor=<iso>&limit=50
// Returns paginated messages oldest→newest. We fetch newest-first (desc by
// createdAt) with a cursor, take `limit + 1`, slice, then reverse for
// chronological ordering. `nextCursor` is the oldest item's createdAt.
export const GET = withErrorHandler(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const user = await getCurrentUser()
  if (!user) return unauthorized()
  const { id } = await ctx.params

  const membership = await db.conversationMember.findUnique({
    where: { conversationId_userId: { conversationId: id, userId: user.id } },
    select: { id: true },
  })
  if (!membership) return forbidden('Anda bukan anggota percakapan ini')

  const { searchParams } = new URL(req.url)
  const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100)
  const cursor = searchParams.get('cursor') // ISO createdAt of oldest already-loaded msg

  const items = await db.message.findMany({
    where: { conversationId: id, ...(cursor ? { createdAt: { lt: new Date(cursor) } } : {}) },
    orderBy: { createdAt: 'desc' },
    take: limit + 1,
    include: {
      sender: {
        select: { id: true, username: true, displayName: true, avatarUrl: true, verified: true },
      },
    },
  })

  const hasMore = items.length > limit
  const page = hasMore ? items.slice(0, limit) : items
  // Chronological order (oldest first)
  const chronological = page.reverse()
  const messages = chronological.map((m) => ({
    ...serializeMessage(m),
    sender: {
      id: m.sender.id,
      username: m.sender.username,
      displayName: m.sender.displayName,
      avatarUrl: m.sender.avatarUrl,
      verified: m.sender.verified,
    },
  }))

  return ok({
    messages,
    nextCursor: hasMore ? messages[0].createdAt : null,
  })
})

// POST /api/conversations/[id]/messages — send a message.
export const POST = withErrorHandler(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireUser()
  const { id } = await ctx.params

  const membership = await db.conversationMember.findUnique({
    where: { conversationId_userId: { conversationId: id, userId: user.id } },
    select: { id: true },
  })
  if (!membership) return forbidden('Anda bukan anggota percakapan ini')

  const body = await parseJson<{ content: string }>(req)
  const content = (body.content || '').trim()
  if (!content) return badRequest('Pesan tidak boleh kosong')
  if (content.length > 2000) return badRequest('Pesan maksimal 2000 karakter')

  // Verify conversation exists
  const conv = await db.conversation.findUnique({ where: { id }, select: { id: true } })
  if (!conv) return notFound('Percakapan tidak ditemukan')

  const message = await db.message.create({
    data: {
      conversationId: id,
      senderId: user.id,
      content,
    },
    include: {
      sender: {
        select: { id: true, username: true, displayName: true, avatarUrl: true, verified: true },
      },
    },
  })

  // Bump conversation.updatedAt so it sorts to top of the list.
  await db.conversation.update({
    where: { id },
    data: { updatedAt: new Date() },
  })

  return ok({
    message: {
      ...serializeMessage(message),
      sender: {
        id: message.sender.id,
        username: message.sender.username,
        displayName: message.sender.displayName,
        avatarUrl: message.sender.avatarUrl,
        verified: message.sender.verified,
      },
    },
  })
})
// touched 1786945215
