import { NextRequest } from 'next/server'
import { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { requireUser } from '@/lib/auth'
import { ok, notFound, withErrorHandler } from '@/lib/api'

// POST /api/posts/[id]/bookmark — toggle bookmark on (no notification)
export const POST = withErrorHandler(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireUser()
  const { id } = await ctx.params

  const post = await db.post.findUnique({ where: { id }, select: { id: true } })
  if (!post) return notFound('Post tidak ditemukan')

  try {
    await db.bookmark.create({ data: { postId: id, userId: user.id } })
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      // already bookmarked — no-op
    } else {
      throw e
    }
  }

  const bookmarkCount = await db.bookmark.count({ where: { postId: id } })
  return ok({ bookmarked: true, bookmarkCount })
})

// DELETE /api/posts/[id]/bookmark — toggle bookmark off
export const DELETE = withErrorHandler(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireUser()
  const { id } = await ctx.params

  await db.bookmark.deleteMany({ where: { postId: id, userId: user.id } })

  const bookmarkCount = await db.bookmark.count({ where: { postId: id } })
  return ok({ bookmarked: false, bookmarkCount })
})
