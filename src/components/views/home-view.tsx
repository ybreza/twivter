'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { RefreshCw, Sparkles, UserPlus, Home as HomeIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { PostCard } from '@/components/post/post-card'
import { PostComposer } from '@/components/post/post-composer'
import {
  ViewHeader,
  EmptyState,
  ErrorState,
  FeedSkeleton,
  LoadingState,
} from '@/components/shared-states'
import { useAuthStore } from '@/stores/app-store'
import type { PostDTO } from '@/lib/types'
import { toast } from 'sonner'

type Tab = 'foryou' | 'following'

interface FeedResponse {
  posts: PostDTO[]
  nextCursor: string | null
}

export function HomeView() {
  const user = useAuthStore((s) => s.user)
  const [tab, setTab] = useState<Tab>('foryou')
  const [posts, setPosts] = useState<PostDTO[]>([])
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [loadingInitial, setLoadingInitial] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const sentinelRef = useRef<HTMLDivElement | null>(null)

  // feed=explore for "For you" (chronological global), feed=home for "Following"
  const feedParam = tab === 'foryou' ? 'explore' : 'home'

  // Set by the effect cleanup below so a slow response for the previous tab
  // cannot land last and overwrite the feed the user is now looking at.
  const ignoreRef = useRef(false)

  const fetchPage = useCallback(
    async (cursor: string | null, mode: 'initial' | 'more' | 'refresh') => {
      if (mode === 'initial') setLoadingInitial(true)
      if (mode === 'more') setLoadingMore(true)
      if (mode === 'refresh') setRefreshing(true)
      setError(null)
      try {
        const url = `/api/posts?feed=${feedParam}&limit=20${cursor ? `&cursor=${cursor}` : ''}`
        const res = await fetch(url, { cache: 'no-store' })
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          throw new Error(err.error || `HTTP ${res.status}`)
        }
        const data: FeedResponse = await res.json()
        if (ignoreRef.current) return
        if (mode === 'more') {
          setPosts((prev) => [...prev, ...(data.posts ?? [])])
        } else {
          setPosts(data.posts ?? [])
        }
        setNextCursor(data.nextCursor ?? null)
      } catch (e: any) {
        if (ignoreRef.current) return
        setError(e.message || 'Gagal memuat feed')
        if (mode === 'initial') toast.error('Gagal memuat feed')
      } finally {
        if (!ignoreRef.current) {
          setLoadingInitial(false)
          setLoadingMore(false)
          setRefreshing(false)
        }
      }
    },
    [feedParam]
  )

  // Refetch on tab change
  useEffect(() => {
    ignoreRef.current = false
    fetchPage(null, 'initial').catch(() => {
      /* handled inside fetchPage */
    })
    return () => {
      ignoreRef.current = true
    }
  }, [fetchPage])

  // Infinite scroll
  const loadMore = useCallback(() => {
    if (loadingMore || loadingInitial || !nextCursor) return
    fetchPage(nextCursor, 'more')
  }, [fetchPage, nextCursor, loadingMore, loadingInitial])

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

  const handlePosted = async (post: PostDTO) => {
    // Optimistically prepend (but only on "For you" tab — following tab may not show own posts if not following self, but API adds self id to following list anyway).
    setPosts((prev) => [post, ...prev])
  }

  const handleDelete = (postId: string) => {
    setPosts((prev) => prev.filter((p) => p.id !== postId))
  }

  const handleRefresh = () => {
    fetchPage(null, 'refresh')
    toast.success('Feed diperbarui')
  }

  return (
    <>
      <ViewHeader
        title="Home"
        rightSlot={
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            aria-label="Refresh"
            className="p-2 rounded-full hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
          >
            <RefreshCw className={cn('h-5 w-5', refreshing && 'animate-spin')} />
          </button>
        }
      >
        {/* Tabs */}
        <div className="flex border-t-0">
          <TabButton
            active={tab === 'foryou'}
            onClick={() => setTab('foryou')}
            label="For you"
            icon={Sparkles}
          />
          <TabButton
            active={tab === 'following'}
            onClick={() => setTab('following')}
            label="Following"
            icon={UserPlus}
          />
        </div>
      </ViewHeader>

      {/* Composer */}
      {user && (
        <div className="border-b border-border">
          <PostComposer onPosted={handlePosted} compact />
        </div>
      )}

      {/* Feed */}
      <div>
        {loadingInitial ? (
          <FeedSkeleton count={5} />
        ) : error ? (
          <ErrorState message={error} onRetry={() => fetchPage(null, 'initial')} />
        ) : posts.length === 0 ? (
          tab === 'following' ? (
            <EmptyState
              icon={HomeIcon}
              title="Belum ada post"
              description="Follow lebih banyak orang untuk melihat post mereka di sini. Atau coba tab 'For you'."
            />
          ) : (
            <EmptyState
              icon={Sparkles}
              title="Feed masih kosong"
              description="Jadilah yang pertama posting sesuatu di Twivter!"
            />
          )
        ) : (
          <>
            {posts.map((p) => (
              <PostCard key={p.id} post={p} onDelete={handleDelete} />
            ))}
            {/* Sentinel for infinite scroll */}
            <div ref={sentinelRef} className="h-4" />
            {loadingMore && <LoadingState message="Memuat lebih banyak..." />}
            {!nextCursor && posts.length > 0 && (
              <div className="text-center text-muted-foreground text-sm py-8">
                Sudah mencapai akhir feed 🎉
              </div>
            )}
          </>
        )}
      </div>
    </>
  )
}

function TabButton({
  active,
  onClick,
  label,
  icon: Icon,
}: {
  active: boolean
  onClick: () => void
  label: string
  icon: typeof Sparkles
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex-1 flex items-center justify-center gap-1.5 py-3.5 text-sm font-medium relative transition-colors hover:bg-muted/40',
        active ? 'text-foreground font-semibold' : 'text-muted-foreground'
      )}
    >
      <Icon className="h-4 w-4" />
      {label}
      {active && (
        <span className="absolute bottom-0 left-1/2 -translate-x-1/2 h-1 w-12 rounded-full bg-primary" />
      )}
    </button>
  )
}

export default HomeView
