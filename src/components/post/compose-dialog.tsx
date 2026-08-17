'use client'

import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { PostComposer } from './post-composer'
import type { PostDTO } from '@/lib/types'
import { toast } from 'sonner'

interface ComposeDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  replyTo?: PostDTO | null
  onPosted?: (post: PostDTO) => void
}

export function ComposeDialog({ open, onOpenChange, replyTo, onPosted }: ComposeDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-0 gap-0 max-w-xl overflow-hidden">
        <DialogTitle className="sr-only">{replyTo ? 'Balas post' : 'Buat post baru'}</DialogTitle>
        <PostComposer
          autoFocus
          replyTo={replyTo}
          onPosted={(post) => {
            onPosted?.(post)
            onOpenChange(false)
            toast.success(replyTo ? 'Balasan terkirim!' : 'Post terkirim!')
          }}
        />
      </DialogContent>
    </Dialog>
  )
}
