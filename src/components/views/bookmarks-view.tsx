'use client'

import { useEffect, useState, useCallback } from 'react'
import { Bookmark } from 'lucide-react'
import { PostCard } from '@/components/post/post-card'
import { ViewHeader, EmptyState, LoadingState, ErrorState } from '@/components/shared-states'
import type { PostDTO } from '@/lib/types'

export function BookmarksView() {
  const [posts, setPosts] = useState<PostDTO[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/posts?feed=bookmarks')
      if (!res.ok) throw new Error('Gagal memuat bookmark')
      const data = await res.json()
      setPosts(data.posts || [])
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  return (
    <>
      <ViewHeader title="Bookmarks" subtitle="Post yang kamu simpan" />
      {loading ? (
        <LoadingState message="Memuat bookmark..." />
      ) : error ? (
        <ErrorState message={error} onRetry={load} />
      ) : posts.length === 0 ? (
        <EmptyState
          icon={Bookmark}
          title="Belum ada bookmark"
          description="Simpan post favoritmu dengan menekan ikon bookmark pada post. Nanti post itu akan muncul di sini."
        />
      ) : (
        posts.map((p) => (
          <PostCard
            key={p.id}
            post={p}
            onDelete={(id) => setPosts((prev) => prev.filter((x) => x.id !== id))}
          />
        ))
      )}
    </>
  )
}
