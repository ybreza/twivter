import { NextRequest } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'
import sharp from 'sharp'
import { getCurrentUser } from '@/lib/auth'
import { badRequest, ok, serverError, unauthorized, withErrorHandler } from '@/lib/api'
import { generateFileName, validateImageFile } from '@/lib/utils'

const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads')

export const POST = withErrorHandler(async (req: NextRequest) => {
  const user = await getCurrentUser()
  if (!user) return unauthorized()

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  const bucket = (formData.get('bucket') as string) || 'posts'

  if (!file) return badRequest('File tidak ditemukan')

  const maxSize = bucket === 'avatars' ? 5 : bucket === 'covers' ? 10 : 5
  const err = validateImageFile(file, maxSize)
  if (err) return badRequest(err)

  try {
    await mkdir(path.join(UPLOAD_DIR, bucket), { recursive: true })

    const buffer = Buffer.from(await file.arrayBuffer())
    const fileName = generateFileName(file.name, `${bucket}_`)
    const filePath = path.join(UPLOAD_DIR, bucket, fileName)

    let processed: Buffer
    if (bucket === 'avatars') {
      processed = await sharp(buffer).resize(400, 400, { fit: 'cover' }).webp({ quality: 85 }).toBuffer()
    } else if (bucket === 'covers') {
      processed = await sharp(buffer).resize(1500, 500, { fit: 'cover' }).webp({ quality: 80 }).toBuffer()
    } else {
      processed = await sharp(buffer).resize(1200, 1200, { fit: 'inside', withoutEnlargement: true }).webp({ quality: 82 }).toBuffer()
    }

    const webpName = fileName.replace(/\.\w+$/, '.webp')
    await writeFile(path.join(UPLOAD_DIR, bucket, webpName), processed)
    const url = `/uploads/${bucket}/${webpName}`

    return ok({ url, fileName: webpName })
  } catch (e: any) {
    return serverError('Gagal mengupload file', e.message)
  }
})
