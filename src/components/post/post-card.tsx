'use client'

import { useState, useEffect } from 'react'
import {
  Heart,
  MessageCircle,
  Repeat2,
  Bookmark,
  Share,
  MoreHorizontal,
  Trash2,
  Flag,
  BarChart3,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCount, timeAgo } from '@/lib/api'
import { UserAvatar } from '@/components/user-avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { toast } from 'sonner'
import { useAuthStore, useViewStore } from '@/stores/app-store'
import type { PostDTO } from '@/lib/types'

interface PostCardProps {
  post: PostDTO
  onReply?: (post: PostDTO) => void
  onDelete?: (postId: string) => void
  showThreadLine?: boolean
  variant?: 'default' | 'compact'
}

export function PostCard({ post, onReply, onDelete, variant = 'default' }: PostCardProps) {
  const user = useAuthStore((s) => s.user)
  const navigate = useViewStore((s) => s.navigate)
  // Plain local state seeded from `post`.
  //
  // `useOptimistic` could never work here: the optimistic value was discarded as
  // soon as the enclosing transition settled and `post` was never updated, so a
  // successful like/repost/bookmark visibly snapped back. It also made the error
  // path a no-op, because it restored `local.*` — which *was* the optimistic
  // value. Now the server response reconciles the real counts and a failure rolls
  // back to the untouched `post.*` counts.
  const [local, setLocal] = useState(post)
  const [liking, setLiking] = useState(false)

  useEffect(() => {
    setLocal(post)
  }, [post])

  const toggleLike = async () => {
    if (!user) {
      toast.error('Login dulu untuk like')
      return
    }
    if (liking) return
    setLiking(true)
    const wasLiked = local.liked
    setLocal((prev) => ({
      ...prev,
      liked: !wasLiked,
      likeCount: Math.max(0, prev.likeCount + (wasLiked ? -1 : 1)),
    }))
    try {
      const res = await fetch(`/api/posts/${post.id}/like`, { method: wasLiked ? 'DELETE' : 'POST' })
      if (!res.ok) throw new Error()
      const data = await res.json().catch(() => null)
      setLocal((prev) => ({
        ...prev,
        liked: typeof data?.liked === 'boolean' ? data.liked : prev.liked,
        likeCount: typeof data?.likeCount === 'number' ? data.likeCount : prev.likeCount,
      }))
    } catch {
      setLocal((prev) => ({ ...prev, liked: wasLiked, likeCount: post.likeCount }))
      toast.error('Gagal update like')
    } finally {
      setLiking(false)
    }
  }

  const toggleBookmark = async () => {
    if (!user) {
      toast.error('Login dulu untuk bookmark')
      return
    }
    const wasBookmarked = local.bookmarked
    setLocal((prev) => ({
      ...prev,
      bookmarked: !wasBookmarked,
      bookmarkCount: Math.max(0, prev.bookmarkCount + (wasBookmarked ? -1 : 1)),
    }))
    try {
      const res = await fetch(`/api/posts/${post.id}/bookmark`, {
        method: wasBookmarked ? 'DELETE' : 'POST',
      })
      if (!res.ok) throw new Error()
      const data = await res.json().catch(() => null)
      setLocal((prev) => ({
        ...prev,
        bookmarked: typeof data?.bookmarked === 'boolean' ? data.bookmarked : prev.bookmarked,
        bookmarkCount:
          typeof data?.bookmarkCount === 'number' ? data.bookmarkCount : prev.bookmarkCount,
      }))
      toast.success(wasBookmarked ? 'Dihapus dari bookmark' : 'Disimpan ke bookmark')
    } catch {
      setLocal((prev) => ({
        ...prev,
        bookmarked: wasBookmarked,
        bookmarkCount: post.bookmarkCount,
      }))
      toast.error('Gagal update bookmark')
    }
  }

  const toggleRepost = async () => {
    if (!user) {
      toast.error('Login dulu untuk repost')
      return
    }
    const wasReposted = local.reposted
    setLocal((prev) => ({
      ...prev,
      reposted: !wasReposted,
      repostCount: Math.max(0, prev.repostCount + (wasReposted ? -1 : 1)),
    }))
    try {
      const res = await fetch(`/api/posts/${post.id}/repost`, {
        method: wasReposted ? 'DELETE' : 'POST',
      })
      if (!res.ok) throw new Error()
      const data = await res.json().catch(() => null)
      setLocal((prev) => ({
        ...prev,
        reposted: typeof data?.reposted === 'boolean' ? data.reposted : prev.reposted,
        repostCount:
          typeof data?.repostCount === 'number' ? data.repostCount : prev.repostCount,
      }))
      toast.success(wasReposted ? 'Repost dibatalkan' : 'Direpost!')
    } catch {
      setLocal((prev) => ({ ...prev, reposted: wasReposted, repostCount: post.repostCount }))
      toast.error('Gagal repost')
    }
  }

  const share = async () => {
    // Read back by `src/app/page.tsx`, which turns `?post=<id>` into a
    // post-detail navigation and then cleans the query string.
    const url = `${window.location.origin}/?post=${post.id}`
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Twivter Post', text: post.content.slice(0, 100), url })
      } else {
        await navigator.clipboard.writeText(url)
        toast.success('Link disalin ke clipboard')
      }
    } catch {
      /* user cancelled */
    }
  }

  const deletePost = async () => {
    try {
      const res = await fetch(`/api/posts/${post.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      toast.success('Post dihapus')
      onDelete?.(post.id)
    } catch {
      toast.error('Gagal menghapus post')
    }
  }

  const reportPost = async () => {
    if (!user) {
      toast.error('Login dulu')
      return
    }
    try {
      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetId: post.author.id, targetType: 'user', reason: `Post: ${post.content.slice(0, 80)}` }),
      })
      if (!res.ok) throw new Error()
      toast.success('Laporan dikirim. Tim moderasi akan meninjau.')
    } catch {
      toast.error('Gagal melaporkan')
    }
  }

  const goToPost = () => navigate('post-detail', { postId: post.id })
  const goToProfile = (e: React.MouseEvent) => {
    e.stopPropagation()
    navigate('profile', { profileUsername: post.author.username })
  }

  return (
    <article
      onClick={goToPost}
      className={cn(
        'group relative px-4 py-3 border-b border-border hover:bg-muted/30 transition-colors cursor-pointer',
        variant === 'compact' && 'py-2.5'
      )}
    >
      <div className="flex gap-3">
        {/* Avatar */}
        <button onClick={goToProfile} className="shrink-0">
          <UserAvatar
            username={post.author.username}
            displayName={post.author.displayName}
            avatarUrl={post.author.avatarUrl}
            verified={post.author.verified}
            size={variant === 'compact' ? 'sm' : 'md'}
          />
        </button>

        {/* Body */}
        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-center gap-1 text-sm">
            <button
              onClick={goToProfile}
              className="font-semibold hover:underline truncate max-w-[40%] sm:max-w-none"
            >
              {post.author.displayName}
            </button>
            {post.author.verified && (
              <svg viewBox="0 0 24 24" className="h-4 w-4 text-primary fill-current shrink-0">
                <path d="M22.25 12c0-1.43-.88-2.67-2.19-3.34.46-1.39.2-2.9-.81-3.91s-2.52-1.27-3.91-.81c-.67-1.31-1.91-2.19-3.34-2.19s-2.67.88-3.33 2.19c-1.4-.46-2.91-.2-3.92.81s-1.26 2.52-.8 3.91c-1.31.67-2.2 1.91-2.2 3.34s.89 2.67 2.2 3.34c-.46 1.39-.21 2.9.8 3.91s2.52 1.26 3.91.81c.67 1.31 1.91 2.19 3.34 2.19s2.67-.88 3.34-2.19c1.39.45 2.9.2 3.91-.81s1.27-2.52.81-3.91c1.31-.67 2.19-1.91 2.19-3.34zm-11.71 4.2L6.8 12.46l1.41-1.42 2.26 2.26 4.8-5.23 1.47 1.36-6.2 6.77z" />
              </svg>
            )}
            <span className="text-muted-foreground truncate">@{post.author.username}</span>
            <span className="text-muted-foreground">·</span>
            <span className="text-muted-foreground hover:underline">{timeAgo(post.createdAt)}</span>

            <div className="ml-auto">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    onClick={(e) => e.stopPropagation()}
                    className="p-1.5 rounded-full hover:bg-primary/10 hover:text-primary text-muted-foreground"
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                  {user?.id === post.author.id ? (
                    <DropdownMenuItem onClick={deletePost} className="text-destructive focus:text-destructive">
                      <Trash2 className="mr-2 h-4 w-4" /> Hapus post
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem onClick={reportPost}>
                      <Flag className="mr-2 h-4 w-4" /> Laporkan
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Content */}
          <div className={cn('mt-0.5 whitespace-pre-wrap break-words text-[15px] leading-relaxed', variant === 'compact' && 'text-sm')}>
            {post.content}
          </div>

          {/* Media */}
          {post.media && post.media.length > 0 && (
            <div
              className={cn(
                'mt-2 grid gap-1 rounded-2xl overflow-hidden border border-border',
                post.media.length === 1 ? 'grid-cols-1' : 'grid-cols-2'
              )}
              onClick={(e) => e.stopPropagation()}
            >
              {post.media.slice(0, 4).map((m) => (
                <div
                  key={m.id}
                  className={cn(
                    'relative bg-muted',
                    post.media!.length === 3 && post.media!.indexOf(m) === 0 && 'row-span-2'
                  )}
                >
                  {m.type === 'image' || m.type === 'gif' ? (
                    <img src={m.url} alt="" className="w-full h-auto max-h-[500px] object-cover" loading="lazy" />
                  ) : m.type === 'video' ? (
                    <video src={m.url} controls className="w-full h-auto max-h-[500px]" />
                  ) : null}
                </div>
              ))}
            </div>
          )}

          {/* Quoted post */}
          {post.quotePost && (
            <div
              onClick={(e) => {
                e.stopPropagation()
                navigate('post-detail', { postId: post.quotePost!.id })
              }}
              className="mt-2 rounded-2xl border border-border p-3 hover:bg-muted/40 transition-colors"
            >
              <div className="flex items-center gap-1 text-sm">
                <span className="font-semibold truncate">{post.quotePost.author.displayName}</span>
                {post.quotePost.author.verified && (
                  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-primary fill-current shrink-0">
                    <path d="M22.25 12c0-1.43-.88-2.67-2.19-3.34.46-1.39.2-2.9-.81-3.91s-2.52-1.27-3.91-.81c-.67-1.31-1.91-2.19-3.34-2.19s-2.67.88-3.33 2.19c-1.4-.46-2.91-.2-3.92.81s-1.26 2.52-.8 3.91c-1.31.67-2.2 1.91-2.2 3.34s.89 2.67 2.2 3.34c-.46 1.39-.21 2.9.8 3.91s2.52 1.26 3.91.81c.67 1.31 1.91 2.19 3.34 2.19s2.67-.88 3.34-2.19c1.39.45 2.9.2 3.91-.81s1.27-2.52.81-3.91c1.31-.67 2.19-1.91 2.19-3.34zm-11.71 4.2L6.8 12.46l1.41-1.42 2.26 2.26 4.8-5.23 1.47 1.36-6.2 6.77z" />
                  </svg>
                )}
                <span className="text-muted-foreground">@{post.quotePost.author.username}</span>
                <span className="text-muted-foreground">·</span>
                <span className="text-muted-foreground">{timeAgo(post.quotePost.createdAt)}</span>
              </div>
              <p className="mt-1 text-sm whitespace-pre-wrap break-words line-clamp-3">{post.quotePost.content}</p>
            </div>
          )}

          {/* Reply context */}
          {post.replyTo && (
            <div className="mt-2 text-xs text-muted-foreground">
              Membalas <span className="text-primary hover:underline">@{post.replyTo.author.username}</span>
            </div>
          )}

          {/* Actions */}
          <div className="mt-2 flex items-center justify-between max-w-md -ml-2">
            <ActionButton
              icon={MessageCircle}
              count={local.commentCount}
              onClick={(e) => {
                e.stopPropagation()
                onReply?.(post)
              }}
              label="Komentar"
            />
            <ActionButton
              icon={Repeat2}
              count={local.repostCount}
              active={local.reposted}
              activeClass="text-emerald-500"
              onClick={(e) => {
                e.stopPropagation()
                toggleRepost()
              }}
              label="Repost"
            />
            <ActionButton
              icon={Heart}
              count={local.likeCount}
              active={local.liked}
              activeClass="text-rose-500 fill-current"
              onClick={(e) => {
                e.stopPropagation()
                toggleLike()
              }}
              disabled={liking}
              label="Like"
            />
            {/* There is no view counter anywhere in the API, so this reports the
                real engagement totals instead of inventing a number. */}
            <ActionButton
              icon={BarChart3}
              count={local.likeCount + local.repostCount + local.commentCount}
              onClick={(e) => e.stopPropagation()}
              label="Interaksi"
              hideOnMobile
            />
            <div className="flex items-center">
              <ActionButton
                icon={Bookmark}
                count={local.bookmarkCount}
                active={local.bookmarked}
                activeClass="text-primary fill-current"
                onClick={(e) => {
                  e.stopPropagation()
                  toggleBookmark()
                }}
                label="Bookmark"
              />
              <ActionButton
                icon={Share}
                onClick={(e) => {
                  e.stopPropagation()
                  share()
                }}
                label="Share"
              />
            </div>
          </div>
        </div>
      </div>
    </article>
  )
}

function ActionButton({
  icon: Icon,
  count = 0,
  active = false,
  activeClass = '',
  onClick,
  label,
  disabled,
  hideOnMobile,
}: {
  icon: typeof Heart
  count?: number
  active?: boolean
  activeClass?: string
  onClick: (e: React.MouseEvent) => void
  label: string
  disabled?: boolean
  hideOnMobile?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={cn(
        'group flex items-center gap-1 px-2 py-1.5 rounded-full text-sm text-muted-foreground transition-colors hover:bg-primary/10 disabled:opacity-50',
        hideOnMobile && 'hidden sm:flex',
        active && activeClass
      )}
    >
      <span className="p-0.5 rounded-full transition-transform group-hover:scale-110">
        <Icon className="h-4 w-4" />
      </span>
      {count > 0 && <span className="text-xs tabular-nums">{formatCount(count)}</span>}
    </button>
  )
}
