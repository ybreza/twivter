import { NextRequest } from 'next/server'
import { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { requireUser } from '@/lib/auth'
import { ok, notFound, withErrorHandler } from '@/lib/api'

// POST /api/posts/[id]/repost — toggle repost on
export const POST = withErrorHandler(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireUser()
  const { id } = await ctx.params

  const post = await db.post.findUnique({ where: { id }, select: { id: true, authorId: true } })
  if (!post) return notFound('Post tidak ditemukan')

  try {
    await db.repost.create({ data: { postId: id, userId: user.id } })
    // Notify post author (skip self)
    if (post.authorId !== user.id) {
      await db.notification.create({
        data: { userId: post.authorId, actorId: user.id, type: 'repost', postId: id },
      }).catch(() => {})
    }
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      // already reposted — no-op
    } else {
      throw e
    }
  }

  const repostCount = await db.repost.count({ where: { postId: id } })
  return ok({ reposted: true, repostCount })
})

// DELETE /api/posts/[id]/repost — toggle repost off
export const DELETE = withErrorHandler(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireUser()
  const { id } = await ctx.params

  await db.repost.deleteMany({ where: { postId: id, userId: user.id } })

  const repostCount = await db.repost.count({ where: { postId: id } })
  return ok({ reposted: false, repostCount })
})
