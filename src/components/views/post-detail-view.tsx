'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { MessageCircle, AlertCircle } from 'lucide-react'
import { PostCard } from '@/components/post/post-card'
import { PostComposer } from '@/components/post/post-composer'
import {
  ViewHeader,
  EmptyState,
  ErrorState,
  LoadingState,
  PostCardSkeleton,
} from '@/components/shared-states'
import { useViewStore } from '@/stores/app-store'
import type { PostDTO } from '@/lib/types'
import { toast } from 'sonner'

interface CommentsResponse {
  posts: PostDTO[]
  nextCursor: string | null
}

export function PostDetailView() {
  const postId = useViewStore((s) => s.postId)
  const navigate = useViewStore((s) => s.navigate)

  // ── Fetch main post ─────────────────────────────
  const postUrl = postId ? `/api/posts/${postId}` : null
  const [post, setPost] = useState<PostDTO | null>(null)
  const [loadingPost, setLoadingPost] = useState(true)
  const [postError, setPostError] = useState<string | null>(null)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    if (!postUrl) return
    let cancelled = false
    setLoadingPost(true)
    setPostError(null)
    setNotFound(false)
    setPost(null)
    ;(async () => {
      try {
        const res = await fetch(postUrl, { cache: 'no-store' })
        if (cancelled) return
        if (res.status === 404) {
          setNotFound(true)
          return
        }
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          throw new Error(err.error || `HTTP ${res.status}`)
        }
        const data = await res.json()
        if (!cancelled) setPost(data.post)
      } catch (e: any) {
        if (!cancelled) setPostError(e.message || 'Gagal memuat post')
      } finally {
        if (!cancelled) setLoadingPost(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [postUrl])

  // ── Comments ────────────────────────────────────
  const [comments, setComments] = useState<PostDTO[]>([])
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [loadingComments, setLoadingComments] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [commentsError, setCommentsError] = useState<string | null>(null)
  const sentinelRef = useRef<HTMLDivElement | null>(null)

  const fetchComments = useCallback(
    async (cursor: string | null, mode: 'initial' | 'more') => {
      if (!postId) return
      if (mode === 'initial') setLoadingComments(true)
      if (mode === 'more') setLoadingMore(true)
      setCommentsError(null)
      try {
        const url = `/api/posts/${postId}/comments?limit=20${cursor ? `&cursor=${cursor}` : ''}`
        const res = await fetch(url, { cache: 'no-store' })
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          throw new Error(err.error || `HTTP ${res.status}`)
        }
        const data: CommentsResponse = await res.json()
        if (mode === 'more') {
          setComments((prev) => [...prev, ...data.posts])
        } else {
          setComments(data.posts)
        }
        setNextCursor(data.nextCursor)
      } catch (e: any) {
        setCommentsError(e.message || 'Gagal memuat komentar')
      } finally {
        setLoadingComments(false)
        setLoadingMore(false)
      }
    },
    [postId]
  )

  useEffect(() => {
    if (!postId) return
    fetchComments(null, 'initial')
  }, [postId, fetchComments])

  // ── Infinite scroll for comments ────────────────
  const loadMore = useCallback(() => {
    if (loadingMore || loadingComments || !nextCursor) return
    fetchComments(nextCursor, 'more')
  }, [fetchComments, nextCursor, loadingMore, loadingComments])

  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) loadMore()
      },
      { rootMargin: '600px 0px' }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [loadMore])

  // ── Handlers ───────────────────────────────────
  const handleReplyPosted = (reply: PostDTO) => {
    setComments((prev) => [reply, ...prev])
    // Also bump parent's commentCount optimistically
    setPost((prev) =>
      prev ? { ...prev, commentCount: prev.commentCount + 1 } : prev
    )
  }

  const handleDeleteComment = (id: string) => {
    setComments((prev) => prev.filter((c) => c.id !== id))
    setPost((prev) =>
      prev ? { ...prev, commentCount: Math.max(0, prev.commentCount - 1) } : prev
    )
  }

  const handleDeletePost = () => {
    // Navigates back home after deletion
    toast.success('Post dihapus')
    navigate('home')
  }

  return (
    <>
      <ViewHeader title="Post" showBack />

      {/* Main post */}
      {loadingPost ? (
        <PostCardSkeleton />
      ) : notFound ? (
        <EmptyState
          icon={AlertCircle}
          title="Post tidak ditemukan"
          description="Post ini mungkin telah dihapus atau tidak pernah ada."
          action={{ label: 'Kembali ke Home', onClick: () => navigate('home') }}
        />
      ) : postError ? (
        <ErrorState message={postError} onRetry={() => location.reload()} />
      ) : post ? (
        <>
          {/* Make the parent post non-clickable wrapper to avoid nav loop */}
          <div className="border-b border-border">
            <PostCard post={post} onDelete={handleDeletePost} />
          </div>

          {/* Reply composer */}
          <div className="border-b border-border">
            <PostComposer
              replyTo={post}
              onPosted={handleReplyPosted}
              placeholder="Post balasan Anda"
              compact
            />
          </div>

          {/* Comments section */}
          <div className="px-4 py-3 border-b border-border sticky top-14 z-20 bg-background/80 backdrop-blur-xl">
            <h2 className="text-base font-semibold flex items-center gap-2">
              <MessageCircle className="h-4 w-4" />
              Komentar
            </h2>
          </div>

          <div>
            {loadingComments ? (
              <>
                <PostCardSkeleton />
                <PostCardSkeleton />
                <PostCardSkeleton />
              </>
            ) : commentsError ? (
              <ErrorState
                message={commentsError}
                onRetry={() => fetchComments(null, 'initial')}
              />
            ) : comments.length === 0 ? (
              <EmptyState
                icon={MessageCircle}
                title="Belum ada komentar"
                description="Jadilah yang pertama memulai percakapan."
              />
            ) : (
              <>
                {comments.map((c) => (
                  <PostCard key={c.id} post={c} onDelete={handleDeleteComment} />
                ))}
                <div ref={sentinelRef} className="h-4" />
                {loadingMore && <LoadingState message="Memuat komentar lain..." />}
                {!nextCursor && comments.length > 0 && (
                  <div className="text-center text-muted-foreground text-sm py-8">
                    Tidak ada komentar lagi.
                  </div>
                )}
              </>
            )}
          </div>
        </>
      ) : null}
    </>
  )
}

export default PostDetailView
