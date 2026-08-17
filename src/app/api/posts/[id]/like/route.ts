import { NextRequest } from 'next/server'
import { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { requireUser } from '@/lib/auth'
import { ok, notFound, withErrorHandler } from '@/lib/api'

// POST /api/posts/[id]/like — toggle like on
export const POST = withErrorHandler(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireUser()
  const { id } = await ctx.params

  const post = await db.post.findUnique({ where: { id }, select: { id: true, authorId: true } })
  if (!post) return notFound('Post tidak ditemukan')

  try {
    await db.like.create({ data: { postId: id, userId: user.id } })
    // Notify post author (skip self)
    if (post.authorId !== user.id) {
      await db.notification.create({
        data: { userId: post.authorId, actorId: user.id, type: 'like', postId: id },
      }).catch(() => {})
    }
  } catch (e) {
    // P2002 = unique constraint violation (already liked). Idempotent — return current state.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      // already liked — no-op
    } else {
      throw e
    }
  }

  const likeCount = await db.like.count({ where: { postId: id } })
  return ok({ liked: true, likeCount })
})

// DELETE /api/posts/[id]/like — toggle like off
export const DELETE = withErrorHandler(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireUser()
  const { id } = await ctx.params

  await db.like.deleteMany({ where: { postId: id, userId: user.id } })

  const likeCount = await db.like.count({ where: { postId: id } })
  return ok({ liked: false, likeCount })
})
