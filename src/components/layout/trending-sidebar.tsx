'use client'

import { useState } from 'react'
import { TrendingUp, UserPlus, UserCheck, Sparkles } from 'lucide-react'
import { useViewStore } from '@/stores/app-store'
import { useApi, apiPost, apiDelete } from '@/lib/hooks'
import { SearchBox } from '@/components/layout/app-shell'
import { UserAvatar } from '@/components/user-avatar'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import { formatCount } from '@/lib/api'
import type { ProfileDTO } from '@/lib/types'

interface ExploreData {
  trending: { tag: string; postsCount: number }[]
  suggestedUsers: ProfileDTO[]
}

export function TrendingSidebar() {
  const { searchQuery, setSearchQuery, navigate } = useViewStore()

  return (
    <div className="space-y-4">
      {/* Search box */}
      <SearchBox
        value={searchQuery}
        onChange={setSearchQuery}
        onSearch={() => navigate('explore', { searchQuery })}
      />

      {/* Trends card */}
      <TrendsCard />

      {/* Who to follow card */}
      <WhoToFollowCard />

      {/* Footer */}
      <Footer />
    </div>
  )
}

function TrendsCard() {
  const { setSearchQuery, navigate } = useViewStore()
  const { data, loading } = useApi<ExploreData>('/api/explore', {})

  return (
    <Card className="overflow-hidden p-0 gap-0 bg-muted/30">
      <div className="px-4 pt-4 pb-2 flex items-center gap-2">
        <TrendingUp className="h-4 w-4 text-primary" />
        <h2 className="font-bold text-base">Trends untuk Anda</h2>
      </div>
      {loading ? (
        <div className="px-4 pb-3 space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="space-y-1.5">
              <Skeleton className="h-2.5 w-20" />
              <Skeleton className="h-3 w-32" />
              <Skeleton className="h-2.5 w-16" />
            </div>
          ))}
        </div>
      ) : (
        <ul>
          {(data?.trending ?? []).slice(0, 5).map((t, i) => (
            <li key={t.tag}>
              <button
                onClick={() => {
                  setSearchQuery(`#${t.tag}`)
                  navigate('explore', { searchQuery: `#${t.tag}` })
                }}
                className="w-full text-left px-4 py-2.5 hover:bg-muted/60 transition-colors"
              >
                <div className="text-xs text-muted-foreground">
                  {i + 1} · Trending
                </div>
                <div className="font-semibold text-sm truncate">#{t.tag}</div>
                <div className="text-xs text-muted-foreground">
                  {formatCount(t.postsCount)} post
                </div>
              </button>
            </li>
          ))}
          <li>
            <button
              onClick={() => navigate('explore')}
              className="w-full text-left px-4 py-3 text-sm text-primary hover:bg-muted/60 transition-colors font-medium"
            >
              Lihat selengkapnya
            </button>
          </li>
        </ul>
      )}
    </Card>
  )
}

function WhoToFollowCard() {
  const { navigate } = useViewStore()
  const { data, loading } = useApi<ExploreData>('/api/explore', {})

  return (
    <Card className="overflow-hidden p-0 gap-0 bg-muted/30">
      <div className="px-4 pt-4 pb-2 flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-primary" />
        <h2 className="font-bold text-base">Siapa untuk diikuti</h2>
      </div>
      {loading ? (
        <div className="px-4 pb-3 space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 py-2">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-2.5 w-20" />
              </div>
              <Skeleton className="h-7 w-16 rounded-full" />
            </div>
          ))}
        </div>
      ) : (data?.suggestedUsers ?? []).length === 0 ? (
        <p className="px-4 pb-4 text-sm text-muted-foreground">Belum ada saran.</p>
      ) : (
        <ul>
          {(data?.suggestedUsers ?? []).slice(0, 3).map((u) => (
            <li key={u.id}>
              <FollowRow user={u} onOpenProfile={() => navigate('profile', { profileUsername: u.username })} />
            </li>
          ))}
          <li>
            <button
              onClick={() => navigate('explore')}
              className="w-full text-left px-4 py-3 text-sm text-primary hover:bg-muted/60 transition-colors font-medium"
            >
              Lihat selengkapnya
            </button>
          </li>
        </ul>
      )}
    </Card>
  )
}

function FollowRow({ user: u, onOpenProfile }: { user: ProfileDTO; onOpenProfile: () => void }) {
  const [following, setFollowing] = useState(u.isFollowing)
  const [busy, setBusy] = useState(false)

  const toggleFollow = async (e: React.MouseEvent) => {
    e.stopPropagation()
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
    <div className="px-4 py-2.5 hover:bg-muted/60 transition-colors flex items-center gap-3">
      <button onClick={onOpenProfile} className="shrink-0">
        <UserAvatar
          username={u.username}
          displayName={u.displayName}
          avatarUrl={u.avatarUrl}
          verified={u.verified}
          size="sm"
        />
      </button>
      <div className="flex-1 min-w-0">
        <button onClick={onOpenProfile} className="flex flex-col items-start text-left hover:underline">
          <span className="text-sm font-semibold truncate max-w-full">{u.displayName}</span>
          <span className="text-xs text-muted-foreground truncate max-w-full">@{u.username}</span>
        </button>
      </div>
      <Button
        size="sm"
        variant={following ? 'outline' : 'default'}
        className="rounded-full font-semibold px-4"
        onClick={toggleFollow}
        disabled={busy}
      >
        {following ? (
          <>
            <UserCheck className="h-3.5 w-3.5 mr-1" /> Mengikuti
          </>
        ) : (
          <>
            <UserPlus className="h-3.5 w-3.5 mr-1" /> Ikuti
          </>
        )}
      </Button>
    </div>
  )
}

function Footer() {
  const links = [
    'Tentang',
    'Bantuan',
    'Syarat',
    'Privasi',
    'Cookie',
    'API',
    'Iklan',
    'Pekerjaan',
  ]
  return (
    <nav className="px-2 pt-1" aria-label="Footer">
      <ul className="flex flex-wrap gap-x-3 gap-y-1.5">
        {links.map((l) => (
          <li key={l}>
            <a
              href="#"
              onClick={(e) => e.preventDefault()}
              className="text-xs text-muted-foreground hover:underline"
            >
              {l}
            </a>
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted-foreground mt-2">© 2025 Twivter, Inc.</p>
    </nav>
  )
}
