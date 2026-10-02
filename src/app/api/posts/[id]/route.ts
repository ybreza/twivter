import { forbiddenError, notFoundError, ok, withErrorHandler } from '@/lib/api'
import { getCurrentUser, requireUser } from '@/lib/auth'
import { first } from '@/lib/db'
import { deletePostCascade, fetchPostPage } from '@/lib/data/posts'

/**
 * `withErrorHandler` types `ctx.params` values as `string | string[]`, which a
 * single route segment never is. Normalise it once.
 */
function pathParam(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? ''
}

// GET /api/posts/[id] — single post
export const GET = withErrorHandler(async (req, ctx) => {
  const user = await getCurrentUser()
  const id = pathParam((await ctx.params).id)

  // `nested` hydrates quotePost/replyTo, which the old POST_INCLUDE did.
  const page = await fetchPostPage({
    where: 'p.id = ?',
    params: [id],
    limit: 1,
    currentUserId: user?.id ?? null,
    nested: true,
  })
  const post = page.posts[0]
  if (!post) throw notFoundError('Post tidak ditemukan')

  return ok({ post })
})

// DELETE /api/posts/[id] — delete own post (cascades media/likes/etc)
export const DELETE = withErrorHandler(async (req, ctx) => {
  const user = await requireUser()
  const id = pathParam((await ctx.params).id)

  const row = await first<{ authorId: string }>(`SELECT authorId FROM Post WHERE id = ?`, [id])
  if (!row) throw notFoundError('Post tidak ditemukan')
  if (row.authorId !== user.id) {
    throw forbiddenError('Anda tidak bisa menghapus post orang lain')
  }

  // Media, likes, bookmarks, reposts, replies, quotes and notifications all have
  // ON DELETE CASCADE, so one statement removes the whole subtree.
  await deletePostCascade(id)
  return ok({ success: true })
})