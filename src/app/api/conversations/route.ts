import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { requireUser, getCurrentUser } from '@/lib/auth'
import { ok, created, badRequest, unauthorized, notFound, withErrorHandler, parseJson } from '@/lib/api'
import {
  serializeConversation,
  CONVERSATION_INCLUDE,
} from '@/lib/serialize'

// GET /api/conversations — list current user's conversations ordered by updatedAt desc.
export const GET = withErrorHandler(async (req: NextRequest) => {
  const user = await getCurrentUser()
  if (!user) return unauthorized()

  const conversations = await db.conversation.findMany({
    where: { members: { some: { userId: user.id } } },
    include: CONVERSATION_INCLUDE,
    orderBy: { updatedAt: 'desc' },
  })

  const serialized = await Promise.all(
    conversations.map((c) => serializeConversation(c, user.id))
  )

  return ok({ conversations: serialized })
})

// POST /api/conversations — start a new conversation.
//   Body (private): { participantId }
//   Body (group):   { name, participantIds: string[] }
export const POST = withErrorHandler(async (req: NextRequest) => {
  const user = await requireUser()
  const body = await parseJson<{
    participantId?: string
    name?: string
    participantIds?: string[]
  }>(req)

  // ── Private conversation ─────────────────────
  if (body.participantId) {
    const otherId = body.participantId
    if (otherId === user.id) return badRequest('Tidak bisa memulai percakapan dengan diri sendiri')

    const other = await db.user.findUnique({
      where: { id: otherId },
      select: { id: true },
    })
    if (!other) return notFound('Pengguna tidak ditemukan')

    // Look for an existing private conversation containing both users.
    // Approach: find ConversationMembers where (userId = me, type private) and
    // intersect with conversations where (userId = other).
    const myConvs = await db.conversationMember.findMany({
      where: { userId: user.id },
      select: { conversationId: true },
    })
    const theirConvs = await db.conversationMember.findMany({
      where: { userId: otherId },
      select: { conversationId: true },
    })
    const theirSet = new Set(theirConvs.map((m) => m.conversationId))
    const candidates = myConvs
      .map((m) => m.conversationId)
      .filter((cid) => theirSet.has(cid))

    if (candidates.length > 0) {
      // Verify it is a private conversation and has exactly 2 members.
      const existing = await db.conversation.findFirst({
        where: { id: { in: candidates }, type: 'private' },
        include: CONVERSATION_INCLUDE,
      })
      if (existing && existing.members.length === 2) {
        return ok({ conversation: await serializeConversation(existing, user.id) })
      }
    }

    const conv = await db.conversation.create({
      data: {
        type: 'private',
        members: {
          create: [{ userId: user.id }, { userId: otherId }],
        },
      },
      include: CONVERSATION_INCLUDE,
    })

    return created({ conversation: await serializeConversation(conv, user.id) })
  }

  // ── Group conversation ───────────────────────
  if (Array.isArray(body.participantIds)) {
    const name = (body.name || '').trim()
    if (!name) return badRequest('Nama grup wajib diisi')
    if (name.length > 60) return badRequest('Nama grup maksimal 60 karakter')
    if (body.participantIds.length === 0)
      return badRequest('Tambahkan minimal satu anggota')

    // De-dup participant ids + creator, ensure all exist.
    const memberIds = Array.from(new Set([user.id, ...body.participantIds]))
    if (memberIds.length < 3) {
      // creator + at least 2 others
      return badRequest('Grup butuh minimal 2 anggota lain')
    }
    const existing = await db.user.findMany({
      where: { id: { in: memberIds } },
      select: { id: true },
    })
    if (existing.length !== memberIds.length) {
      return notFound('Salah satu peserta tidak ditemukan')
    }

    const conv = await db.conversation.create({
      data: {
        type: 'group',
        name,
        members: {
          create: memberIds.map((id) => ({ userId: id })),
        },
      },
      include: CONVERSATION_INCLUDE,
    })

    return created({ conversation: await serializeConversation(conv, user.id) })
  }

  return badRequest('Body tidak valid — kirim { participantId } atau { name, participantIds }')
})
