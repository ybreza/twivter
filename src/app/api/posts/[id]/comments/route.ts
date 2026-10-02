import { ok, withErrorHandler } from '@/lib/api'
import { getCurrentUser } from '@/lib/auth'
import { parseLimit } from '@/lib/db'
import { fetchPostPage } from '@/lib/data/posts'

function pathParam(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? ''
}

// GET /api/posts/[id]/comments?cursor=<id>&limit=20
// Top-level replies to a post, oldest-first (Twitter-like).
//
// Replies are `Post` rows with `replyToId` set. Pagination is a keyset on the
// id column: the old `cursor: { id }` over `orderBy: { createdAt }` skipped and
// repeated rows because `createdAt` is not unique.
export const GET = withErrorHandler(async (req, ctx) => {
  const user = await getCurrentUser()
  const id = pathParam((await ctx.params).id)
  const { searchParams } = new URL(req.url)

  const limit = parseLimit(searchParams.get('limit'), 20, 50)
  const cursor = searchParams.get('cursor')

  const page = await fetchPostPage({
    where: 'p.replyToId = ?',
    params: [id],
    order: 'asc',
    limit,
    cursor,
    currentUserId: user?.id ?? null,
    nested: true,
  })

  return ok(page)
})