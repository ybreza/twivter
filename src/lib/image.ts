/**
 * Client-side image preparation.
 *
 * The upload pipeline used to run `sharp` on the Node server to resize and
 * convert uploads to WebP. `sharp` is a native module and cannot run on Cloudflare
 * Workers, so the work moved here: the browser decodes the image, draws it to a
 * canvas at the target size, and re-encodes as WebP before uploading. The
 * benefits are a smaller R2 object and no server CPU per upload.
 */

export interface ImageTarget {
  /** Longest edge after scaling. Ignored when `maxWidth`/`maxHeight` are set. */
  maxEdge?: number
  /** Used together with `maxHeight` for fixed-aspect targets (covers). */
  maxWidth?: number
  maxHeight?: number
  quality: number
}

export const IMAGE_TARGETS = {
  posts: { maxEdge: 1200, quality: 0.82 },
  avatars: { maxEdge: 400, quality: 0.85 },
  covers: { maxWidth: 1500, maxHeight: 500, quality: 0.8 },
} as const satisfies Record<string, ImageTarget>

export type MediaBucket = keyof typeof IMAGE_TARGETS

/** Hard cap on the source file, before decoding. */
export const MAX_SOURCE_BYTES = 12 * 1024 * 1024

const ACCEPTED = /^image\/(jpeg|png|webp|gif|avif)$/

export function isAcceptedImage(file: File): boolean {
  return ACCEPTED.test(file.type)
}

export interface PreparedImage {
  blob: Blob
  width: number
  height: number
  contentType: string
  /** Original bytes, used to report the compression ratio. */
  originalBytes: number
}

function loadBitmap(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === 'function') {
    return createImageBitmap(file).catch(() => loadViaImgElement(file))
  }
  return loadViaImgElement(file)
}

function loadViaImgElement(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Gambar tidak dapat dibaca'))
    }
    img.src = url
  })
}

/** Computes the output size, never upscaling. */
export function fitDimensions(
  source: { width: number; height: number },
  target: ImageTarget,
): { width: number; height: number } {
  let { width, height } = source
  if (target.maxWidth !== undefined && target.maxHeight !== undefined) {
    const scale = Math.min(target.maxWidth / width, target.maxHeight / height, 1)
    width = Math.max(1, Math.round(width * scale))
    height = Math.max(1, Math.round(height * scale))
    return { width, height }
  }
  const scale = Math.min((target.maxEdge ?? source.width) / Math.max(width, height), 1)
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  }
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Gagal meng-encode gambar'))),
      type,
      quality,
    )
  })
}

/**
 * Decodes, downscales and re-encodes an image.
 *
 * GIFs are passed through untouched — re-encoding would drop the animation.
 */
export async function prepareImage(file: File, bucket: MediaBucket): Promise<PreparedImage> {
  if (!isAcceptedImage(file)) {
    throw new Error('Format gambar tidak didukung (JPEG, PNG, WebP, GIF, atau AVIF)')
  }
  if (file.size > MAX_SOURCE_BYTES) {
    throw new Error('Ukuran gambar maksimal 12 MB')
  }

  const target = IMAGE_TARGETS[bucket]

  if (file.type === 'image/gif') {
    return {
      blob: file,
      width: 0,
      height: 0,
      contentType: file.type,
      originalBytes: file.size,
    }
  }

  const bitmap = await loadBitmap(file)
  const sourceWidth = 'width' in bitmap ? bitmap.width : 0
  const sourceHeight = 'height' in bitmap ? bitmap.height : 0
  if (!sourceWidth || !sourceHeight) throw new Error('Gambar tidak dapat dibaca')

  const { width, height } = fitDimensions({ width: sourceWidth, height: sourceHeight }, target)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Browser tidak mendukung pemrosesan gambar')
  ctx.drawImage(bitmap as CanvasImageSource, 0, 0, width, height)
  if ('close' in bitmap && typeof bitmap.close === 'function') bitmap.close()

  let blob = await canvasToBlob(canvas, 'image/webp', target.quality)

  // Safari < 14 and some older engines cannot encode WebP. Fall back to JPEG.
  if (blob.type !== 'image/webp') {
    blob = await canvasToBlob(canvas, 'image/jpeg', target.quality)
  }

  return { blob, width, height, contentType: blob.type, originalBytes: file.size }
}

/**
 * Uploads a prepared image to `/api/upload`.
 * Rejects non-2xx responses with the server's Indonesian error message.
 */
export async function uploadPreparedImage(
  prepared: PreparedImage,
  bucket: MediaBucket,
  signal?: AbortSignal,
): Promise<{ url: string }> {
  const formData = new FormData()
  formData.append('file', prepared.blob, `image.${prepared.contentType.split('/')[1] ?? 'webp'}`)
  formData.append('bucket', bucket)

  const res = await fetch('/api/upload', { method: 'POST', body: formData, signal })
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new Error(body?.error ?? 'Upload gagal')
  }
  const data = (await res.json()) as { url?: string }
  if (!data.url) throw new Error('Respons upload tidak valid')
  return { url: data.url }
}

/** Convenience: prepare + upload in one call. */
export async function uploadImage(
  file: File,
  bucket: MediaBucket,
  signal?: AbortSignal,
): Promise<{ url: string }> {
  const prepared = await prepareImage(file, bucket)
  return uploadPreparedImage(prepared, bucket, signal)
}