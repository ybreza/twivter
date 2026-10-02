import { notFoundError, ok, withErrorHandler } from '@/lib/api'
import { requireUser } from '@/lib/auth'
import { execute, first, scalar } from '@/lib/db'
import { newId } from '@/lib/ids'

function pathParam(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? ''
}

// POST /api/posts/[id]/bookmark — bookmark a post (idempotent, no notification)
export const POST = withErrorHandler(async (req, ctx) => {
  const user = await requireUser()
  const id = pathParam((await ctx.params).id)

  const post = await first<{ id: string }>(`SELECT id FROM Post WHERE id = ?`, [id])
  if (!post) throw notFoundError('Post tidak ditemukan')

  // Idempotent via the UNIQUE (postId, userId) index.
  await execute(
    `INSERT OR IGNORE INTO Bookmark (id, postId, userId) VALUES (?, ?, ?)`,
    [newId(), id, user.id],
  )

  const bookmarkCount = await scalar<number>(`SELECT COUNT(*) FROM Bookmark WHERE postId = ?`, [id], 0)
  return ok({ bookmarked: true, bookmarkCount })
})

// DELETE /api/posts/[id]/bookmark — remove a bookmark
export const DELETE = withErrorHandler(async (req, ctx) => {
  const user = await requireUser()
  const id = pathParam((await ctx.params).id)

  // 404 when the post is gone; the old handler always answered 200.
  const post = await first<{ id: string }>(`SELECT id FROM Post WHERE id = ?`, [id])
  if (!post) throw notFoundError('Post tidak ditemukan')

  await execute(`DELETE FROM Bookmark WHERE postId = ? AND userId = ?`, [id, user.id])

  const bookmarkCount = await scalar<number>(`SELECT COUNT(*) FROM Bookmark WHERE postId = ?`, [id], 0)
  return ok({ bookmarked: false, bookmarkCount })
})