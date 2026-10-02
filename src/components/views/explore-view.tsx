'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Search, TrendingUp, Sparkles, Hash, Users, X, UserPlus, UserCheck } from 'lucide-react'
import { useViewStore } from '@/stores/app-store'
import { useApi, apiPost, apiDelete } from '@/lib/hooks'
import { SearchBox } from '@/components/layout/app-shell'
import { ViewHeader, EmptyState, LoadingState, ErrorState, FeedSkeleton } from '@/components/shared-states'
import { PostCard } from '@/components/post/post-card'
import { UserAvatar } from '@/components/user-avatar'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Card } from '@/components/ui/card'
import { toast } from 'sonner'
import { formatCount } from '@/lib/api'
import type { PostDTO, ProfileDTO, CommunityDTO } from '@/lib/types'

interface ExploreData {
  trending: { tag: string; postsCount: number }[]
  suggestedUsers: ProfileDTO[]
  trendingPosts: PostDTO[]
}

interface SearchResult {
  posts: PostDTO[]
  users: ProfileDTO[]
  communities: CommunityDTO[]
}

export function ExploreView() {
  const searchQuery = useViewStore((s) => s.searchQuery)
  const setSearchQuery = useViewStore((s) => s.setSearchQuery)
  const hasSearch = searchQuery.trim().length > 0

  return (
    <>
      <ViewHeader title="Explore" subtitle="Temukan tren dan orang baru">
        <div className="px-4 pb-3">
          <SearchBox
            value={searchQuery}
            onChange={setSearchQuery}
            onSearch={() => {
              /* live-updates via debounced effect in SearchResults */
            }}
          />
          {hasSearch && (
            <button
              onClick={() => setSearchQuery('')}
              className="mt-2 inline-flex items-center gap-1 text-xs text-primary hover:underline"
            >
              <X className="h-3 w-3" /> Hapus pencarian
            </button>
          )}
        </div>
      </ViewHeader>

      {hasSearch ? <SearchResults query={searchQuery} /> : <ExploreHome />}
    </>
  )
}

// ── Default explore view (no search) ───────────
function ExploreHome() {
  const { data, loading, error, refetch } = useApi<ExploreData>('/api/explore', {})
  const navigate = useViewStore((s) => s.navigate)
  const setSearchQuery = useViewStore((s) => s.setSearchQuery)

  if (loading) return <FeedSkeleton count={4} />
  if (error) return <ErrorState message={error} onRetry={refetch} />
  if (!data) return null

  return (
    <div className="divide-y divide-border">
      {/* Trending hashtags */}
      <section className="py-4">
        <div className="px-4 mb-2 flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-primary" />
          <h2 className="font-bold text-base">Trends untuk Anda</h2>
        </div>
        <ul>
          {data.trending.slice(0, 10).map((t, i) => (
            <li key={t.tag}>
              <button
                onClick={() => {
                  setSearchQuery(`#${t.tag}`)
                  navigate('explore', { searchQuery: `#${t.tag}` })
                }}
                className="w-full text-left px-4 py-2.5 hover:bg-muted/40 transition-colors flex items-center gap-3"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-muted-foreground">#{i + 1} · Trending</div>
                  <div className="font-semibold text-[15px] truncate">#{t.tag}</div>
                  <div className="text-xs text-muted-foreground">{formatCount(t.postsCount)} post</div>
                </div>
                <Hash className="h-4 w-4 text-muted-foreground shrink-0" />
              </button>
            </li>
          ))}
        </ul>
      </section>

      {/* Suggested users */}
      <section className="py-4">
        <div className="px-4 mb-3 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <h2 className="font-bold text-base">Saran untuk Anda</h2>
        </div>
        {data.suggestedUsers.length === 0 ? (
          <p className="px-4 text-sm text-muted-foreground">Belum ada saran.</p>
        ) : (
          <div className="flex gap-3 overflow-x-auto px-4 pb-2 scrollbar-thin">
            {data.suggestedUsers.map((u) => (
              <SuggestedUserCard key={u.id} user={u} />
            ))}
          </div>
        )}
      </section>

      {/* Trending posts */}
      <section className="py-4">
        <div className="px-4 mb-2 flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-primary" />
          <h2 className="font-bold text-base">Sedang Trending</h2>
        </div>
        {data.trendingPosts.length === 0 ? (
          <EmptyState icon={TrendingUp} title="Belum ada post trending" description="Post terpopuler akan muncul di sini." />
        ) : (
          <div>
            {data.trendingPosts.map((p) => (
              <PostCard key={p.id} post={p} />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function SuggestedUserCard({ user: u }: { user: ProfileDTO }) {
  const navigate = useViewStore((s) => s.navigate)
  const [following, setFollowing] = useState(u.isFollowing)
  const [busy, setBusy] = useState(false)

  // Re-sync when the same user comes back from a refetch with a new flag.
  useEffect(() => {
    setFollowing(u.isFollowing)
  }, [u.isFollowing])

  const toggleFollow = async () => {
    setBusy(true)
    const wasFollowing = following
    setFollowing(!wasFollowing)
    try {
      if (wasFollowing) {
        await apiDelete(`/api/follow?targetUserId=${u.id}`)
        toast.success(`Berhenti mengikuti @${u.username}`)
      } else {
        await apiPost('/api/follow', { targetUserId: u.id })
        toast.success(`Mengikuti @${u.username}`)
      }
    } catch (e: any) {
      setFollowing(wasFollowing)
      toast.error(e?.message || 'Gagal memperbarui follow')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="p-3 w-44 sm:w-52 shrink-0 flex flex-col items-center text-center gap-2 shadow-sm">
      <button
        onClick={() => navigate('profile', { profileUsername: u.username })}
        className="flex flex-col items-center gap-1.5 w-full"
      >
        <UserAvatar
          username={u.username}
          displayName={u.displayName}
          avatarUrl={u.avatarUrl}
          verified={u.verified}
          size="lg"
        />
        <div className="font-semibold text-sm truncate max-w-full">{u.displayName}</div>
        <div className="text-xs text-muted-foreground truncate max-w-full">@{u.username}</div>
      </button>
      <div className="text-[11px] text-muted-foreground">{formatCount(u.followersCount)} pengikut</div>
      <Button
        size="sm"
        variant={following ? 'outline' : 'default'}
        className="rounded-full w-full font-semibold"
        onClick={toggleFollow}
        disabled={busy}
      >
        {following ? (
          <>
            <UserCheck className="h-4 w-4 mr-1" /> Mengikuti
          </>
        ) : (
          <>
            <UserPlus className="h-4 w-4 mr-1" /> Ikuti
          </>
        )}
      </Button>
    </Card>
  )
}

// ── Search results view ─────────────────────────
function SearchResults({ query }: { query: string }) {
  const navigate = useViewStore((s) => s.navigate)
  const [activeTab, setActiveTab] = useState<'posts' | 'users' | 'communities'>('posts')
  const [debounced, setDebounced] = useState(query)
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<SearchResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Debounce search query (300ms — spec)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 300)
    return () => clearTimeout(t)
  }, [query])

  // Fetch on debounced change. `runSearch` takes the live flag from the effect
  // cleanup, so a slow response for an older query cannot overwrite the results
  // for the current one.
  const ignoreRef = useRef(false)

  const runSearch = useCallback(async (q: string) => {
    setLoading(true)
    setError(null)
    try {
      const r = await fetch(`/api/search?q=${encodeURIComponent(q)}`)
      if (ignoreRef.current) return
      const json = await r.json()
      if (ignoreRef.current) return
      if (!json || json.error) throw new Error(json?.error || 'Gagal mencari')
      setResults(json)
    } catch (e: any) {
      if (ignoreRef.current) return
      setError(e.message)
    } finally {
      if (!ignoreRef.current) setLoading(false)
    }
  }, [])

  useEffect(() => {
    ignoreRef.current = false
    if (!debounced.trim()) return
    runSearch(debounced).catch(() => {
      /* handled inside runSearch */
    })
    return () => {
      ignoreRef.current = true
    }
  }, [debounced, runSearch])

  return (
    <div>
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
        <div className="border-b border-border">
          <TabsList className="bg-transparent h-auto p-0 rounded-none w-full grid grid-cols-3">
            <TabsTrigger
              value="posts"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none py-3"
            >
              Posts
            </TabsTrigger>
            <TabsTrigger
              value="users"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none py-3"
            >
              Pengguna
            </TabsTrigger>
            <TabsTrigger
              value="communities"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none py-3"
            >
              Komunitas
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="posts" className="mt-0">
          {loading ? (
            <FeedSkeleton count={4} />
          ) : error ? (
            <ErrorState message={error} />
          ) : !results || results.posts.length === 0 ? (
            <EmptyState
              icon={Search}
              title="Tidak ada post ditemukan"
              description={`Coba kata kunci lain selain "${debounced}".`}
            />
          ) : (
            results.posts.map((p) => <PostCard key={p.id} post={p} />)
          )}
        </TabsContent>

        <TabsContent value="users" className="mt-0">
          {loading ? (
            <LoadingState message="Mencari pengguna..." />
          ) : error ? (
            <ErrorState message={error} />
          ) : !results || results.users.length === 0 ? (
            <EmptyState
              icon={Users}
              title="Tidak ada pengguna ditemukan"
              description={`Coba username atau nama lain selain "${debounced}".`}
            />
          ) : (
            <div className="divide-y divide-border">
              {results.users.map((u) => (
                <UserResultRow key={u.id} user={u} onOpen={() => navigate('profile', { profileUsername: u.username })} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="communities" className="mt-0">
          {loading ? (
            <LoadingState message="Mencari komunitas..." />
          ) : error ? (
            <ErrorState message={error} />
          ) : !results || results.communities.length === 0 ? (
            <EmptyState
              icon={Users}
              title="Tidak ada komunitas ditemukan"
              description={`Coba kata kunci lain selain "${debounced}".`}
            />
          ) : (
            <div className="p-4 grid sm:grid-cols-2 gap-3">
              {results.communities.map((c) => (
                <CommunityMiniCard key={c.id} community={c} />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}

function UserResultRow({ user: u, onOpen }: { user: ProfileDTO; onOpen: () => void }) {
  const [following, setFollowing] = useState(u.isFollowing)
  const [busy, setBusy] = useState(false)

  // Re-sync when the same user comes back from a refetch with a new flag.
  useEffect(() => {
    setFollowing(u.isFollowing)
  }, [u.isFollowing])

  const toggleFollow = async () => {
    setBusy(true)
    const was = following
    setFollowing(!was)
    try {
      if (was) {
        await apiDelete(`/api/follow?targetUserId=${u.id}`)
        toast.success(`Berhenti mengikuti @${u.username}`)
      } else {
        await apiPost('/api/follow', { targetUserId: u.id })
        toast.success(`Mengikuti @${u.username}`)
      }
    } catch (e: any) {
      setFollowing(was)
      toast.error(e?.message || 'Gagal')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="px-4 py-3 flex items-center gap-3 hover:bg-muted/30 transition-colors">
      <button onClick={onOpen}>
        <UserAvatar
          username={u.username}
          displayName={u.displayName}
          avatarUrl={u.avatarUrl}
          verified={u.verified}
        />
      </button>
      <div className="flex-1 min-w-0">
        <button onClick={onOpen} className="flex flex-col items-start text-left hover:underline">
          <span className="font-semibold text-sm truncate">{u.displayName}</span>
          <span className="text-xs text-muted-foreground truncate">@{u.username}</span>
        </button>
        {u.bio && <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{u.bio}</p>}
        <div className="text-xs text-muted-foreground mt-0.5">
          {formatCount(u.followersCount)} pengikut
        </div>
      </div>
      {!u.isSelf && (
        <Button
          size="sm"
          variant={following ? 'outline' : 'default'}
          className="rounded-full font-semibold"
          onClick={toggleFollow}
          disabled={busy}
        >
          {following ? 'Mengikuti' : 'Ikuti'}
        </Button>
      )}
    </div>
  )
}

function CommunityMiniCard({ community: c }: { community: CommunityDTO }) {
  const [isMember, setIsMember] = useState(c.isMember)
  const [membersCount, setMembersCount] = useState(c.membersCount)
  const [busy, setBusy] = useState(false)

  // Re-sync when the same community comes back from a refetch.
  useEffect(() => {
    setIsMember(c.isMember)
    setMembersCount(c.membersCount)
  }, [c.isMember, c.membersCount])

  const toggleJoin = async () => {
    setBusy(true)
    const was = isMember
    try {
      if (was) {
        const res = await apiDelete<{ isMember: boolean; membersCount: number }>(
          `/api/communities/${c.id}/join`
        )
        setIsMember(res.isMember)
        setMembersCount(res.membersCount)
        toast.success(`Anda keluar dari ${c.name}`)
      } else {
        const res = await apiPost<{ isMember: boolean; membersCount: number }>(
          `/api/communities/${c.id}/join`
        )
        setIsMember(res.isMember)
        setMembersCount(res.membersCount)
        toast.success(`Anda bergabung dengan ${c.name}`)
      }
    } catch (e: any) {
      toast.error(e?.message || 'Gagal memperbarui keanggotaan')
      setIsMember(was)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="p-4 gap-2 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-sm truncate">{c.name}</div>
          <div className="text-xs text-muted-foreground truncate">@{c.slug}</div>
        </div>
        <Button
          size="sm"
          variant={isMember ? 'outline' : 'default'}
          className="rounded-full font-semibold"
          onClick={toggleJoin}
          disabled={busy}
        >
          {isMember ? 'Bergabung' : 'Gabung'}
        </Button>
      </div>
      {c.description && (
        <p className="text-xs text-muted-foreground line-clamp-2">{c.description}</p>
      )}
      <div className="text-[11px] text-muted-foreground">
        {formatCount(membersCount)} anggota
      </div>
    </Card>
  )
}
