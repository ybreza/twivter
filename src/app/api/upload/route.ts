import { BUCKET_MAX_BYTES, isMediaBucket, putObject, type MediaBucket } from '@/lib/storage'
import { badRequestError, ok, tooLargeError, withErrorHandler } from '@/lib/api'
import { requireUser } from '@/lib/auth'

// Headroom over the per-file cap for the multipart envelope. `formData()` buffers
// the entire body in memory on a Worker, so the caps stay small.
const FORM_OVERHEAD_BYTES = 64 * 1024

/** Largest per-bucket cap, i.e. the absolute ceiling for a single file. */
const MAX_FILE_BYTES = Math.max(...Object.values(BUCKET_MAX_BYTES))
/** Absolute ceiling: the largest bucket cap plus the multipart envelope. */
const MAX_REQUEST_BYTES = MAX_FILE_BYTES + FORM_OVERHEAD_BYTES

function resolveBucket(raw: unknown): MediaBucket {
  if (raw === undefined || raw === null || raw === '') return 'posts'
  // `isMediaBucket` is the allow-list that closes the old path-traversal hole:
  // the bucket used to be interpolated straight into
  // `path.join(UPLOAD_DIR, bucket)`, so `bucket="../../.."` escaped
  // `public/uploads`.
  if (!isMediaBucket(raw)) throw badRequestError('Bucket tidak valid')
  return raw
}

const fmt = (bytes: number) => `${(bytes / (1024 * 1024)).toFixed(1)} MB`

/**
 * Parses the multipart body, turning a wrong content type into a 400.
 *
 * `Request.formData()` throws a `TypeError` when the body is not multipart,
 * which surfaced as a 500. `formData: bad content type` was a plausible client
 * mistake, not a server fault.
 */
async function readFormData(req: Request): Promise<FormData> {
  const contentType = req.headers.get('content-type') ?? ''
  if (
    !contentType.includes('multipart/form-data') &&
    !contentType.includes('application/x-www-form-urlencoded')
  ) {
    throw badRequestError('Upload harus menggunakan multipart/form-data')
  }
  try {
    return await req.formData()
  } catch {
    throw badRequestError('Body multipart tidak valid')
  }
}

// POST /api/upload — multipart/form-data { file: File, bucket?: MediaBucket }
// Returns: { url: '/uploads/<key>', fileName: '<key>' }
//
// Images are resized to WebP **in the browser** before upload; `sharp` and the
// local filesystem are gone because neither works on Cloudflare Workers. This
// route only validates and stores the bytes.
export const POST = withErrorHandler(async (req) => {
  await requireUser()

  // Reject an obviously oversized body from the declared length, before
  // `formData()` buffers the whole thing into memory.
  const declaredLength = Number(req.headers.get('content-length') ?? '0')
  const hasDeclaredLength = Number.isFinite(declaredLength) && declaredLength > 0
  if (hasDeclaredLength && declaredLength > MAX_REQUEST_BYTES) {
    throw tooLargeError(`Ukuran upload maksimal ${fmt(MAX_FILE_BYTES)}`)
  }

  const formData = await readFormData(req)
  const entry = formData.get('file')
  if (!entry || typeof entry === 'string') throw badRequestError('File tidak ditemukan')
  const file = entry as File

  // Validated *after* form parsing so the multipart envelope is already accounted
  // for; before this point the bucket was fully attacker-controlled.
  const bucket = resolveBucket(formData.get('bucket'))
  const maxBytes = BUCKET_MAX_BYTES[bucket]

  // `formData()` holds the whole body in memory, so the cap is checked twice:
  // once against the declared length and once against the decoded file.
  if (hasDeclaredLength && declaredLength > maxBytes + FORM_OVERHEAD_BYTES) {
    throw tooLargeError(`Ukuran file maksimal ${fmt(maxBytes)}`)
  }
  if (file.size === 0) throw badRequestError('File kosong')
  if (file.size > maxBytes) throw tooLargeError(`Ukuran file maksimal ${fmt(maxBytes)}`)

  if (!file.type || !file.type.toLowerCase().startsWith('image/')) {
    throw badRequestError('Hanya berkas gambar yang diperbolehkan')
  }

  const bytes = new Uint8Array(await file.arrayBuffer())
  if (bytes.byteLength > maxBytes) throw tooLargeError(`Ukuran file maksimal ${fmt(maxBytes)}`)

  const stored = await putObject(bucket, bytes, file.type)

  return ok({ url: stored.url, fileName: stored.key })
})