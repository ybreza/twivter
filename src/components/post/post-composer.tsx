'use client'

import { useState, useRef, useTransition } from 'react'
import { ImagePlus, X, Smile, Calendar, MapPin, Loader2, Globe } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Progress } from '@/components/ui/progress'
import { cn, validateImageFile } from '@/lib/utils'
import { useAuthStore } from '@/stores/app-store'
import { UserAvatar } from '@/components/user-avatar'
import { toast } from 'sonner'
import type { PostDTO } from '@/lib/types'

interface PostComposerProps {
  placeholder?: string
  replyTo?: PostDTO | null
  onPosted?: (post: PostDTO) => void
  autoFocus?: boolean
  compact?: boolean
}

const MAX_CHARS = 280

export function PostComposer({
  placeholder = "Apa yang sedang terjadi?",
  replyTo,
  onPosted,
  autoFocus,
  compact,
}: PostComposerProps) {
  const user = useAuthStore((s) => s.user)
  const [content, setContent] = useState('')
  const [media, setMedia] = useState<{ url: string; type: string; file?: File }[]>([])
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [isPending, startTransition] = useTransition()
  const fileRef = useRef<HTMLInputElement>(null)

  const remaining = MAX_CHARS - content.length
  const overLimit = remaining < 0
  const canPost = content.trim().length > 0 && !overLimit && !uploading && !isPending

  const handleFile = async (file: File) => {
    const err = validateImageFile(file, 5)
    if (err) {
      toast.error(err)
      return
    }
    if (media.length >= 4) {
      toast.error('Maksimal 4 gambar per post')
      return
    }
    setUploading(true)
    setUploadProgress(0)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('bucket', 'posts')
      // fake progress
      const interval = setInterval(() => {
        setUploadProgress((p) => Math.min(p + 10, 90))
      }, 80)
      const res = await fetch('/api/upload', { method: 'POST', body: formData })
      clearInterval(interval)
      setUploadProgress(100)
      if (!res.ok) throw new Error('Upload gagal')
      const data = await res.json()
      setMedia((prev) => [...prev, { url: data.url, type: 'image' }])
    } catch (e) {
      toast.error('Gagal upload gambar')
    } finally {
      setUploading(false)
      setTimeout(() => setUploadProgress(0), 500)
    }
  }

  const removeMedia = (idx: number) => {
    setMedia((prev) => prev.filter((_, i) => i !== idx))
  }

  const submit = async () => {
    if (!canPost) return
    startTransition(async () => {
      try {
        const res = await fetch('/api/posts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: content.trim(),
            media: media.map((m) => ({ url: m.url, type: m.type })),
            replyToId: replyTo?.id ?? null,
          }),
        })
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          throw new Error(err.error || 'Gagal membuat post')
        }
        const data = await res.json()
        toast.success(replyTo ? 'Balasan terkirim!' : 'Post terkirim! 🎉')
        setContent('')
        setMedia([])
        onPosted?.(data.post)
      } catch (e: any) {
        toast.error(e.message || 'Gagal membuat post')
      }
    })
  }

  if (!user) return null

  return (
    <div className={cn('flex gap-3', compact ? 'p-3' : 'p-4')}>
      <UserAvatar
        username={user.username}
        displayName={user.displayName}
        avatarUrl={user.avatarUrl}
        verified={user.verified}
        size="md"
      />
      <div className="flex-1 min-w-0">
        {replyTo && (
          <div className="text-sm text-muted-foreground mb-2">
            Membalas <span className="text-primary">@{replyTo.author.username}</span>
          </div>
        )}
        <Textarea
          autoFocus={autoFocus}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={placeholder}
          rows={compact ? 2 : 3}
          className="border-0 resize-none px-0 text-lg placeholder:text-muted-foreground focus-visible:ring-0 bg-transparent"
        />

        {/* Media preview */}
        {media.length > 0 && (
          <div className={cn('grid gap-2 mt-2', media.length === 1 ? 'grid-cols-1' : 'grid-cols-2')}>
            {media.map((m, i) => (
              <div key={i} className="relative rounded-xl overflow-hidden border border-border">
                <img src={m.url} alt="" className="w-full h-auto max-h-72 object-cover" />
                <button
                  onClick={() => removeMedia(i)}
                  className="absolute top-2 right-2 bg-background/80 backdrop-blur rounded-full p-1 hover:bg-background"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        {uploading && (
          <div className="mt-2">
            <Progress value={uploadProgress} className="h-1" />
          </div>
        )}

        {/* Toolbar */}
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
          <div className="flex items-center gap-0.5">
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              multiple
              className="hidden"
              onChange={(e) => {
                const files = Array.from(e.target.files ?? [])
                files.forEach(handleFile)
                e.target.value = ''
              }}
            />
            <ToolbarBtn icon={ImagePlus} disabled={uploading || media.length >= 4} onClick={() => fileRef.current?.click()} />
            <ToolbarBtn icon={Globe} label="Publik" />
            <ToolbarBtn icon={Smile} className="hidden sm:flex" />
            <ToolbarBtn icon={Calendar} className="hidden sm:flex" />
            <ToolbarBtn icon={MapPin} className="hidden sm:flex" />
          </div>

          <div className="flex items-center gap-3">
            {content.length > 0 && (
              <div className="flex items-center gap-2">
                <div className="relative h-7 w-7">
                  <svg className="h-7 w-7 -rotate-90" viewBox="0 0 28 28">
                    <circle cx="14" cy="14" r="12" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-muted/30" />
                    <circle
                      cx="14"
                      cy="14"
                      r="12"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      className={overLimit ? 'text-destructive' : 'text-primary'}
                      strokeDasharray={`${(Math.min(content.length, MAX_CHARS) / MAX_CHARS) * 75.4} 75.4`}
                      strokeLinecap="round"
                    />
                  </svg>
                  {remaining <= 20 && (
                    <span className={cn('absolute inset-0 flex items-center justify-center text-[10px] font-medium', overLimit ? 'text-destructive' : 'text-muted-foreground')}>
                      {remaining}
                    </span>
                  )}
                </div>
              </div>
            )}
            <Button
              onClick={submit}
              disabled={!canPost}
              className="rounded-full px-5 font-semibold"
            >
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : replyTo ? 'Reply' : 'Post'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

function ToolbarBtn({
  icon: Icon,
  onClick,
  disabled,
  label,
  className,
}: {
  icon: typeof ImagePlus
  onClick?: () => void
  disabled?: boolean
  label?: string
  className?: string
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'flex items-center gap-1 px-2 py-1.5 rounded-full text-primary hover:bg-primary/10 disabled:opacity-40 disabled:hover:bg-transparent transition-colors text-sm',
        className
      )}
    >
      <Icon className="h-[18px] w-[18px]" />
      {label && <span className="hidden sm:inline">{label}</span>}
    </button>
  )
}
