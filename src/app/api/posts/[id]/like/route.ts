import { notFoundError, ok, withErrorHandler } from '@/lib/api'
import { requireUser } from '@/lib/auth'
import { execute, first, scalar } from '@/lib/db'
import { createNotification } from '@/lib/data/notifications'
import { newId } from '@/lib/ids'

function pathParam(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? ''
}

// POST /api/posts/[id]/like — like a post (idempotent)
export const POST = withErrorHandler(async (req, ctx) => {
  const user = await requireUser()
  const id = pathParam((await ctx.params).id)

  const post = await first<{ id: string; authorId: string }>(
    `SELECT id, authorId FROM Post WHERE id = ?`,
    [id],
  )
  if (!post) throw notFoundError('Post tidak ditemukan')

  // `INSERT OR IGNORE` against the UNIQUE (postId, userId) index: a double tap
  // is a no-op instead of the 500 the old `catch (P2002)` dance produced.
  const inserted = await execute(
    `INSERT OR IGNORE INTO Like (id, postId, userId) VALUES (?, ?, ?)`,
    [newId(), id, user.id],
  )

  // Notify the post author (skipped for self-likes by `createNotification`).
  if (inserted > 0) {
    try {
      await createNotification({
        userId: post.authorId,
        actorId: user.id,
        type: 'like',
        postId: id,
      })
    } catch (err) {
      // Best-effort: the like is already stored and must not be undone.
      console.error('[like] gagal membuat notifikasi', err)
    }
  }

  const likeCount = await scalar<number>(`SELECT COUNT(*) FROM Like WHERE postId = ?`, [id], 0)
  return ok({ liked: true, likeCount })
})

// DELETE /api/posts/[id]/like — remove a like
export const DELETE = withErrorHandler(async (req, ctx) => {
  const user = await requireUser()
  const id = pathParam((await ctx.params).id)

  // The old handler deleted unconditionally, so un-liking a post that no longer
  // exists answered 200 with `{ liked: false, likeCount: 0 }` instead of 404.
  const post = await first<{ id: string }>(`SELECT id FROM Post WHERE id = ?`, [id])
  if (!post) throw notFoundError('Post tidak ditemukan')

  await execute(`DELETE FROM Like WHERE postId = ? AND userId = ?`, [id, user.id])

  const likeCount = await scalar<number>(`SELECT COUNT(*) FROM Like WHERE postId = ?`, [id], 0)
  return ok({ liked: false, likeCount })
})