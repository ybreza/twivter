import { getObject } from '@/lib/storage'

/**
 * GET /uploads/<bucket>/<yyyy>/<mm>/<id>.<ext> — serves a media object out of R2.
 *
 * Replaces writing files into `public/uploads` on the Node server. That
 * directory is not part of the deployed artifact on Workers, so every uploaded
 * image 404'd after the first deploy.
 *
 * No auth: these are public post avatars/covers.
 */
export async function GET(
  req: Request,
  ctx: { params: Promise<Record<string, string | string[] | undefined>> },
): Promise<Response> {
  const params = await ctx.params
  const segments = params.path
  const parts = Array.isArray(segments) ? segments : [segments]
  const key = parts.filter((s): s is string => typeof s === 'string' && s.length > 0).join('/')

  if (!key) {
    return new Response('Not found', { status: 404 })
  }

  // `getObject` normalises the key and rejects traversal (`..`), backslashes,
  // absolute paths and anything outside its charset, so it returns null for a
  // bad key as well as a missing object.
  const object = await getObject(key)
  if (!object) {
    return new Response('Not found', { status: 404 })
  }

  const etag = object.etag
  const headers = new Headers({
    'content-type': object.contentType,
    'content-length': String(object.size),
    // Keys embed a unique id, so bytes at a given URL never change.
    'cache-control': 'public, max-age=31536000, immutable',
    etag,
  })

  const ifNoneMatch = req.headers.get('if-none-match')
  if (ifNoneMatch && ifNoneMatch.split(',').some((t) => t.trim() === etag || t.trim() === `W/${etag}`)) {
    return new Response(null, { status: 304, headers })
  }

  return new Response(object.body, { status: 200, headers })
}