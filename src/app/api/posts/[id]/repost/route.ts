import { notFoundError, ok, withErrorHandler } from '@/lib/api'
import { requireUser } from '@/lib/auth'
import { execute, first, scalar } from '@/lib/db'
import { createNotification } from '@/lib/data/notifications'
import { newId } from '@/lib/ids'

function pathParam(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? ''
}

// POST /api/posts/[id]/repost — repost a post (idempotent)
export const POST = withErrorHandler(async (req, ctx) => {
  const user = await requireUser()
  const id = pathParam((await ctx.params).id)

  const post = await first<{ id: string; authorId: string }>(
    `SELECT id, authorId FROM Post WHERE id = ?`,
    [id],
  )
  if (!post) throw notFoundError('Post tidak ditemukan')

  // `INSERT OR IGNORE` against the UNIQUE (postId, userId) index: re-posting is
  // a no-op instead of a unique-constraint 500.
  const inserted = await execute(
    `INSERT OR IGNORE INTO Repost (id, postId, userId) VALUES (?, ?, ?)`,
    [newId(), id, user.id],
  )

  if (inserted > 0) {
    try {
      await createNotification({
        userId: post.authorId,
        actorId: user.id,
        type: 'repost',
        postId: id,
      })
    } catch (err) {
      // Best-effort: the repost is already stored and must not be undone.
      console.error('[repost] gagal membuat notifikasi', err)
    }
  }

  const repostCount = await scalar<number>(`SELECT COUNT(*) FROM Repost WHERE postId = ?`, [id], 0)
  return ok({ reposted: true, repostCount })
})

// DELETE /api/posts/[id]/repost — remove a repost
export const DELETE = withErrorHandler(async (req, ctx) => {
  const user = await requireUser()
  const id = pathParam((await ctx.params).id)

  // 404 when the post is gone; the old handler always answered 200.
  const post = await first<{ id: string }>(`SELECT id FROM Post WHERE id = ?`, [id])
  if (!post) throw notFoundError('Post tidak ditemukan')

  await execute(`DELETE FROM Repost WHERE postId = ? AND userId = ?`, [id, user.id])

  const repostCount = await scalar<number>(`SELECT COUNT(*) FROM Repost WHERE postId = ?`, [id], 0)
  return ok({ reposted: false, repostCount })
})