'use client'

/**
 * Upload orchestration shared by the post composer, the profile editor and
 * onboarding.
 *
 * The previous implementation had two defects this hook fixes: `files.forEach`
 * checked a stale `media.length` so selecting 6 images attached all 6 despite
 * the 4-image limit, and a `setTimeout` set state after unmount.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { uploadImage, type MediaBucket } from '@/lib/image'

export interface UploadedMedia {
  url: string
  type: string
}

export function useImageUpload(options: {
  bucket: MediaBucket
  /** Maximum number of attachments kept at once. */
  max?: number
  onChange?: (media: UploadedMedia[]) => void
}) {
  const { bucket, max = 4, onChange } = options

  const [media, setMedia] = useState<UploadedMedia[]>([])
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)

  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  const abortRef = useRef<AbortController | null>(null)
  const progressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const mountedRef = useRef(true)

  // Counters rather than array identity: `handleFiles` used to read a stale
  // `media.length` while concurrent uploads were still in flight.
  const mediaRef = useRef<UploadedMedia[]>([])
  mediaRef.current = media

  const clearTimers = useCallback(() => {
    if (progressTimerRef.current) clearInterval(progressTimerRef.current)
    if (resetTimerRef.current) clearTimeout(resetTimerRef.current)
    progressTimerRef.current = null
    resetTimerRef.current = null
  }, [])

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      abortRef.current?.abort()
      clearTimers()
    }
  }, [clearTimers])

  const startProgress = useCallback(() => {
    setProgress(0)
    clearTimers()
    progressTimerRef.current = setInterval(() => {
      if (mountedRef.current) setProgress((p) => Math.min(p + 8, 90))
    }, 100)
  }, [clearTimers])

  const stopProgress = useCallback(() => {
    clearTimers()
    if (!mountedRef.current) return
    setProgress(100)
    // Let the bar reach 100% before clearing it, and never after unmount.
    resetTimerRef.current = setTimeout(() => {
      if (mountedRef.current) setProgress(0)
    }, 400)
  }, [clearTimers])

  const handleFiles = useCallback(
    async (files: File[]) => {
      if (files.length === 0) return
      const room = Math.max(0, max - mediaRef.current.length)
      if (room === 0) {
        toast.error(`Maksimal ${max} gambar`)
        return
      }
      const selected = files.slice(0, room)
      if (selected.length < files.length) {
        toast.error(`Hanya ${room} gambar lagi yang bisa ditambahkan`)
      }

      setUploading(true)
      startProgress()
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller

      const results: UploadedMedia[] = []
      try {
        for (const file of selected) {
          const { url } = await uploadImage(file, bucket, controller.signal)
          results.push({ url, type: 'image' })
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          toast.error(error instanceof Error ? error.message : 'Gagal meng-upload gambar')
        }
      } finally {
        stopProgress()
        if (!controller.signal.aborted && mountedRef.current && results.length > 0) {
          const next = [...mediaRef.current, ...results]
          mediaRef.current = next
          setMedia(next)
          onChangeRef.current?.(next)
        }
        if (mountedRef.current) setUploading(false)
      }
    },
    [bucket, max, startProgress, stopProgress],
  )

  const replaceMedia = useCallback(
    (next: UploadedMedia[]) => {
      mediaRef.current = next
      if (mountedRef.current) setMedia(next)
      onChangeRef.current?.(next)
    },
    [],
  )

  const removeMedia = useCallback(
    (index: number) => {
      const next = mediaRef.current.filter((_, i) => i !== index)
      mediaRef.current = next
      if (mountedRef.current) setMedia(next)
      onChangeRef.current?.(next)
    },
    [],
  )

  const reset = useCallback(() => {
    mediaRef.current = []
    if (mountedRef.current) setMedia([])
    onChangeRef.current?.([])
  }, [])

  return {
    media,
    uploading,
    progress,
    handleFiles,
    removeMedia,
    replaceMedia,
    reset,
    canAddMore: media.length < max,
    remainingSlots: Math.max(0, max - media.length),
  }
}