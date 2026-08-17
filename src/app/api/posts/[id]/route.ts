import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser, requireUser } from '@/lib/auth'
import { ok, notFound, forbidden, withErrorHandler } from '@/lib/api'
import { serializePost, POST_INCLUDE } from '@/lib/serialize'

// GET /api/posts/[id] — single post
export const GET = withErrorHandler(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const user = await getCurrentUser()
  const { id } = await ctx.params

  const post = await db.post.findUnique({
    where: { id },
    include: POST_INCLUDE,
  })
  if (!post) return notFound('Post tidak ditemukan')

  const serialized = await serializePost(post, user?.id)
  return ok({ post: serialized })
})

// DELETE /api/posts/[id] — delete own post (cascades media/likes/etc)
export const DELETE = withErrorHandler(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireUser()
  const { id } = await ctx.params

  const post = await db.post.findUnique({ where: { id }, select: { authorId: true } })
  if (!post) return notFound('Post tidak ditemukan')
  if (post.authorId !== user.id) return forbidden('Anda tidak bisa menghapus post orang lain')

  await db.post.delete({ where: { id } })
  return ok({ success: true })
})
