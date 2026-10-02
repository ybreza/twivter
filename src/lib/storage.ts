/**
 * Media storage on Cloudflare R2.
 *
 * Previously images were written to `public/uploads` on the Node server with
 * `sharp`. Neither works on Workers: `sharp` is a native module and the
 * container filesystem is ephemeral, so every deploy silently lost user uploads.
 *
 * Images are now resized/compressed **in the browser** (see
 * `src/components/post/image-upload.tsx`) and the resulting WebP blob is stored
 * as an R2 object, served back through `/uploads/[...path]`.
 */
import { getCloudflareContext } from '@opennextjs/cloudflare'
import type { R2BucketLike } from './worker-bindings'
import { newId } from './ids'

export const MEDIA_BUCKETS = ['posts', 'avatars', 'covers'] as const
export type MediaBucket = (typeof MEDIA_BUCKETS)[number]

/** Per-bucket upload ceiling, enforced server-side. */
export const BUCKET_MAX_BYTES: Record<MediaBucket, number> = {
  avatars: 3 * 1024 * 1024,
  covers: 6 * 1024 * 1024,
  posts: 8 * 1024 * 1024,
}

export function isMediaBucket(value: unknown): value is MediaBucket {
  return typeof value === 'string' && (MEDIA_BUCKETS as readonly string[]).includes(value)
}

async function mediaBucket(): Promise<R2BucketLike> {
  const { env } = await getCloudflareContext({ async: true })
  const bucket = (env as Record<string, unknown> | undefined)?.MEDIA as R2BucketLike | undefined
  if (!bucket) {
    throw new Error(
      'R2 binding "MEDIA" tidak ditemukan. Jalankan `wrangler r2 bucket create twivter-media` ' +
        'lalu pastikan binding MEDIA ada di wrangler.jsonc.',
    )
  }
  return bucket
}

/** Shards by month so a single bucket never accumulates one enormous prefix. */
function objectKey(bucket: MediaBucket, id: string, contentType: string): string {
  const now = new Date()
  const yyyy = now.getUTCFullYear()
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0')
  const ext = extensionFor(contentType)
  return `${bucket}/${yyyy}/${mm}/${id}.${ext}`
}

function extensionFor(contentType: string): string {
  switch (contentType) {
    case 'image/webp':
      return 'webp'
    case 'image/png':
      return 'png'
    case 'image/jpeg':
      return 'jpg'
    case 'image/gif':
      return 'gif'
    case 'image/avif':
      return 'avif'
    default:
      return 'bin'
  }
}

/** Strips any path/query injection from a client-supplied storage key. */
export function normalizeObjectKey(raw: string): string | null {
  let key = raw
  try {
    // Accept both `/uploads/posts/x.webp` and `posts/x.webp`.
    key = decodeURIComponent(raw).replace(/^\/+/, '')
  } catch {
    return null
  }
  key = key.replace(/^\/?uploads\//, '')
  if (!key) return null
  // Reject absolute paths and backslashes outright.
  if (key.includes('\\') || key.startsWith('/')) return null
  // A traversal segment can never survive: `..` is rejected by the segment
  // pattern below, and `a/../b` still matches `/../`.
  if (/(^|\/)\.\.?(\/|$)/.test(key)) return null
  // Dots are allowed so file extensions work (`posts/2026/10/x.webp`), but the
  // previous charset rejected them outright, which made every stored image 404
  // even though the upload succeeded.
  if (!/^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(key)) return null
  if (key.length > 512) return null
  return key
}

export interface StoredObject {
  key: string
  /** App-relative URL served by the `/uploads/[...path]` route. */
  url: string
  size: number
  contentType: string
}

/** Writes bytes to R2 and returns the public URL for the object. */
export async function putObject(
  bucket: MediaBucket,
  bytes: ArrayBuffer | Uint8Array,
  contentType: string,
  id: string = newId(),
): Promise<StoredObject> {
  const key = objectKey(bucket, id, contentType)
  const r2 = await mediaBucket()
  await r2.put(key, bytes, {
    httpMetadata: {
      contentType,
      // Immutable: the key contains a unique id, so the bytes never change.
      cacheControl: 'public, max-age=31536000, immutable',
    },
    customMetadata: { bucket },
  })
  return {
    key,
    url: `/uploads/${key}`,
    size: bytes.byteLength,
    contentType,
  }
}

/** Reads an object back. Returns null when it does not exist. */
export async function getObject(
  key: string,
): Promise<{ body: ReadableStream; contentType: string; etag: string; size: number; uploaded: Date } | null> {
  const normalized = normalizeObjectKey(key)
  if (!normalized) return null
  const r2 = await mediaBucket()
  const object = await r2.get(normalized)
  if (!object || !object.body) return null
  return {
    body: object.body,
    contentType: object.httpMetadata?.contentType ?? 'application/octet-stream',
    etag: object.etag,
    size: object.size,
    uploaded: new Date(object.uploaded),
  }
}

/** Removes an object. Accepts both `posts/x.webp` and `/uploads/posts/x.webp`. */
export async function deleteObject(rawKey: string): Promise<void> {
  const normalized = normalizeObjectKey(rawKey)
  if (!normalized) return
  const r2 = await mediaBucket()
  await r2.delete(normalized)
}

/** Best-effort removal; never throws, so it is safe inside a `finally`. */
export async function tryDeleteObject(rawKey: string | null | undefined): Promise<void> {
  if (!rawKey) return
  try {
    await deleteObject(rawKey)
  } catch (err) {
    console.warn('[storage] failed to delete object', rawKey, err)
  }
}