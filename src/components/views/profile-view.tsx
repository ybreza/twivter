'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  CalendarDays,
  MapPin,
  Link2,
  Loader2,
  MessageCircle,
  ImageIcon,
  MessageSquareText,
  Heart,
  UserRound,
  PencilLine,
} from 'lucide-react'
import { useApi, apiPost, apiDelete } from '@/lib/hooks'
import { useAuthStore, useViewStore } from '@/stores/app-store'
import { ViewHeader, EmptyState, ErrorState, FeedSkeleton } from '@/components/shared-states'
import { UserAvatar } from '@/components/user-avatar'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PostCard } from '@/components/post/post-card'
import { EditProfileDialog } from '@/components/profile/edit-profile-dialog'
import { toast } from 'sonner'
import { cn, displayWebsite, normalizeWebsiteUrl } from '@/lib/utils'
import { formatCount } from '@/lib/api'
import type { ProfileDTO, PostDTO } from '@/lib/types'

type Tab = 'posts' | 'replies' | 'media' | 'likes'

const TABS: { id: Tab; label: string; icon: typeof UserRound }[] = [
  { id: 'posts', label: 'Posts', icon: MessageSquareText },
  { id: 'replies', label: 'Balasan', icon: MessageCircle },
  { id: 'media', label: 'Media', icon: ImageIcon },
  { id: 'likes', label: 'Suka', icon: Heart },
]

// Deterministic gradient for cover fallback
const coverGradients = [
  'from-primary/40 via-accent/30 to-primary/60',
  'from-purple-500/40 via-pink-500/30 to-rose-500/50',
  'from-emerald-500/40 via-teal-500/30 to-cyan-500/50',
  'from-amber-500/40 via-orange-500/30 to-rose-500/50',
  'from-indigo-500/40 via-blue-500/30 to-cyan-500/50',
]
function gradientFor(username: string) {
  let hash = 0
  for (let i = 0; i < username.length; i++) hash = username.charCodeAt(i) + ((hash << 5) - hash)
  return coverGradients[Math.abs(hash) % coverGradients.length]
}

export function ProfileView() {
  const profileUsername = useViewStore((s) => s.profileUsername)
  const navigate = useViewStore((s) => s.navigate)
  const setConversation = useViewStore((s) => s.setConversation)
  const currentUser = useAuthStore((s) => s.user)

  const {
    data: profile,
    loading,
    error,
    refetch,
    setData: setProfile,
  } = useApi<ProfileDTO>(
    profileUsername ? `/api/profiles/${encodeURIComponent(profileUsername)}` : null,
    { deps: [profileUsername] }
  )

  const [tab, setTab] = useState<Tab>('posts')
  const [editOpen, setEditOpen] = useState(false)
  const [followPending, setFollowPending] = useState(false)
  const [messagePending, setMessagePending] = useState(false)

  // Reset tab when switching profile
  useEffect(() => {
    setTab('posts')
  }, [profileUsername])

  const handleFollowToggle = async () => {
    if (!profile || !currentUser) return
    if (profile.isSelf) return
    setFollowPending(true)
    const wasFollowing = profile.isFollowing
    // optimistic
    setProfile({
      ...profile,
      isFollowing: !wasFollowing,
      followersCount: profile.followersCount + (wasFollowing ? -1 : 1),
    })
    try {
      const targetUserId = profile.id
      if (wasFollowing) {
        await apiDelete(`/api/follow?targetUserId=${encodeURIComponent(targetUserId)}`)
      } else {
        await apiPost('/api/follow', { targetUserId })
      }
    } catch (e: any) {
      // revert
      setProfile({
        ...profile,
        isFollowing: wasFollowing,
        followersCount: profile.followersCount,
      })
      toast.error(e.message || 'Gagal mengubah status follow')
    } finally {
      setFollowPending(false)
    }
  }

  // Opens (or reuses) the private thread with this profile before navigating —
  // previously it only navigated, so no conversation was selected and the
  // messages view opened on an empty state.
  const handleMessage = async () => {
    if (!profile || profile.isSelf) return
    setMessagePending(true)
    try {
      const res = await apiPost<{ conversation: { id: string } }>('/api/conversations', {
        participantId: profile.id,
      })
      setConversation(res.conversation.id)
      navigate('messages', { conversationId: res.conversation.id })
    } catch (e: any) {
      toast.error(e.message || 'Gagal membuka percakapan')
    } finally {
      setMessagePending(false)
    }
  }

  if (!profileUsername) {
    return (
      <div>
        <ViewHeader title="Profil" showBack />
        <EmptyState
          icon={UserRound}
          title="Profil tidak ditemukan"
          description="Username tidak ditentukan."
        />
      </div>
    )
  }

  if (loading) {
    return (
      <div>
        <ViewHeader title="Memuat…" showBack />
        <ProfileSkeleton />
      </div>
    )
  }

  if (error || !profile) {
    return (
      <div>
        <ViewHeader title="Profil" showBack />
        <ErrorState
          message={error || 'Profil tidak ditemukan'}
          onRetry={refetch}
        />
      </div>
    )
  }

  const joinDate = new Date(profile.createdAt).toLocaleDateString('id-ID', {
    month: 'long',
    year: 'numeric',
  })

  // Profiles created before the scheme rule still hold a bare domain. Rendering
  // that through a next/link `<Link>` made the router treat it as a route of this
  // app and prefetch `/twivter.com?_rsc=…`, which 404s. Normalising here means a
  // legacy row produces a correct external link immediately, without a data
  // migration, and `null` hides the row instead of linking to something broken.
  const websiteHref = normalizeWebsiteUrl(profile.website)

  return (
    <div>
      <ViewHeader
        title={profile.displayName}
        subtitle={`${formatCount(profile.postsCount)} post`}
        showBack
      />

      {/* Cover */}
      <div className="relative">
        <div
          className={cn(
            'h-32 sm:h-48 w-full bg-gradient-to-br',
            !profile.coverUrl && gradientFor(profile.username)
          )}
          style={
            profile.coverUrl
              ? {
                  backgroundImage: `url(${profile.coverUrl})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                }
              : undefined
          }
        />
      </div>

      {/* Header row: avatar + actions */}
      <div className="px-4 -mt-12 sm:-mt-16">
        <div className="flex items-end justify-between">
          <div className="rounded-full ring-4 ring-background">
            <UserAvatar
              username={profile.username}
              displayName={profile.displayName}
              avatarUrl={profile.avatarUrl}
              verified={profile.verified}
              size="2xl"
            />
          </div>

          <div className="flex items-center gap-2 mb-1">
            {profile.isSelf ? (
              <Button
                variant="secondary"
                className="rounded-full font-semibold"
                onClick={() => setEditOpen(true)}
              >
                <PencilLine className="h-4 w-4 sm:mr-1.5" />
                <span className="hidden sm:inline">Edit profil</span>
              </Button>
            ) : (
              <>
                <Button
                  variant="secondary"
                  className="rounded-full font-semibold"
                  onClick={handleMessage}
                  disabled={messagePending}
                  title="Pesan"
                >
                  {messagePending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <MessageCircle className="h-4 w-4" />
                  )}
                  <span className="hidden sm:inline ml-1.5">Pesan</span>
                </Button>
                <Button
                  variant={profile.isFollowing ? 'secondary' : 'default'}
                  className={cn(
                    'rounded-full font-semibold min-w-[7rem]',
                    profile.isFollowing && 'hover:bg-destructive/10 hover:text-destructive'
                  )}
                  disabled={followPending}
                  onClick={handleFollowToggle}
                >
                  {followPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : profile.isFollowing ? (
                    <span className="group-hover:hidden">Mengikuti</span>
                  ) : (
                    'Ikuti'
                  )}
                  {profile.isFollowing && !followPending && (
                    <span className="hidden group-hover:inline text-destructive">Berhenti ikuti</span>
                  )}
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Identity */}
        <div className="mt-3">
          <div className="flex items-center gap-1">
            <h2 className="text-xl font-bold truncate">{profile.displayName}</h2>
            {profile.verified && (
              <svg viewBox="0 0 24 24" className="h-5 w-5 text-primary fill-current shrink-0">
                <path d="M22.25 12c0-1.43-.88-2.67-2.19-3.34.46-1.39.2-2.9-.81-3.91s-2.52-1.27-3.91-.81c-.67-1.31-1.91-2.19-3.34-2.19s-2.67.88-3.33 2.19c-1.4-.46-2.91-.2-3.92.81s-1.26 2.52-.8 3.91c-1.31.67-2.2 1.91-2.2 3.34s.89 2.67 2.2 3.34c-.46 1.39-.21 2.9.8 3.91s2.52 1.26 3.91.81c.67 1.31 1.91 2.19 3.34 2.19s2.67-.88 3.34-2.19c1.39.45 2.9.2 3.91-.81s1.27-2.52.81-3.91c1.31-.67 2.19-1.91 2.19-3.34zm-11.71 4.2L6.8 12.46l1.41-1.42 2.26 2.26 4.8-5.23 1.47 1.36-6.2 6.77z" />
              </svg>
            )}
          </div>
          <p className="text-muted-foreground text-sm">@{profile.username}</p>
        </div>

        {/* Bio */}
        {profile.bio && (
          <p className="mt-3 text-[15px] whitespace-pre-wrap break-words leading-relaxed">
            {profile.bio}
          </p>
        )}

        {/* Meta row */}
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
          {profile.location && (
            <span className="flex items-center gap-1">
              <MapPin className="h-4 w-4" />
              {profile.location}
            </span>
          )}
          {websiteHref && (
            <a
              href={websiteHref}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-primary hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              <Link2 className="h-4 w-4" />
              {displayWebsite(profile.website)}
            </a>
          )}
          <span className="flex items-center gap-1">
            <CalendarDays className="h-4 w-4" />
            Bergabung {joinDate}
          </span>
        </div>

        {/* Stats */}
        <div className="mt-3 flex items-center gap-4 text-sm">
          <button
            className="hover:underline"
            onClick={() => {/* future: open following list */}}
          >
            <span className="font-bold">{formatCount(profile.followingCount)}</span>{' '}
            <span className="text-muted-foreground">Mengikuti</span>
          </button>
          <button
            className="hover:underline"
            onClick={() => {/* future: open followers list */}}
          >
            <span className="font-bold">{formatCount(profile.followersCount)}</span>{' '}
            <span className="text-muted-foreground">Pengikut</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs
        value={tab}
        onValueChange={(v) => setTab(v as Tab)}
        className="mt-4 w-full"
      >
        <TabsList className="w-full h-12 rounded-none bg-transparent p-0 border-b border-border justify-between">
          {TABS.map(({ id, label, icon: Icon }) => (
            <TabsTrigger
              key={id}
              value={id}
              className="flex-1 h-12 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-primary text-muted-foreground gap-1.5"
            >
              <Icon className="h-4 w-4 sm:hidden" />
              <span>{label}</span>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {/* Posts list */}
      <ProfilePostsList username={profile.username} tab={tab} />

      {/* Edit dialog */}
      <EditProfileDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        onSaved={(updated) => {
          // Refetch profile to reflect new avatar/cover/name in view
          setProfile({ ...profile, ...updated })
        }}
      />
    </div>
  )
}

function ProfilePostsList({ username, tab }: { username: string; tab: Tab }) {
  const [posts, setPosts] = useState<PostDTO[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cursor, setCursor] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)

  // Set by the effect cleanup so a slow response for a profile/tab the user has
  // already left cannot overwrite the current one. Read by `fetchFirst`.
  const ignoreRef = useRef(false)

  const fetchFirst = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(
        `/api/profiles/${encodeURIComponent(username)}/posts?tab=${tab}&limit=20`
      )
      if (!res.ok) {
        const e = await res.json().catch(() => ({}))
        throw new Error(e.error || `HTTP ${res.status}`)
      }
      const data = await res.json()
      if (ignoreRef.current) return
      setPosts(data.posts ?? [])
      setCursor(data.nextCursor ?? null)
      setHasMore(!!data.nextCursor)
    } catch (e: any) {
      if (ignoreRef.current) return
      setError(e.message || 'Gagal memuat post')
    } finally {
      if (!ignoreRef.current) setLoading(false)
    }
  }, [username, tab])

  useEffect(() => {
    ignoreRef.current = false
    fetchFirst().catch(() => {
      /* handled inside fetchFirst */
    })
    return () => {
      ignoreRef.current = true
    }
  }, [fetchFirst])

  const loadMore = async () => {
    if (!cursor || loadingMore) return
    setLoadingMore(true)
    try {
      const res = await fetch(
        `/api/profiles/${encodeURIComponent(username)}/posts?tab=${tab}&limit=20&cursor=${cursor}`
      )
      // An error body has no `posts`, so spreading it used to throw
      // `[...prev, ...undefined]` and unmount the whole view.
      if (!res.ok) {
        const e = await res.json().catch(() => ({}))
        throw new Error(e.error || `HTTP ${res.status}`)
      }
      const data = await res.json()
      setPosts((prev) => [...prev, ...(data.posts ?? [])])
      setCursor(data.nextCursor ?? null)
      setHasMore(!!data.nextCursor)
    } catch {
      toast.error('Gagal memuat lebih banyak post')
    } finally {
      setLoadingMore(false)
    }
  }

  if (loading) return <FeedSkeleton count={5} />
  if (error) return <ErrorState message={error} onRetry={fetchFirst} />
  if (posts.length === 0) {
    const emptyMap: Record<Tab, { title: string; description: string }> = {
      posts: {
        title: 'Belum ada post',
        description: 'Post yang dibuat pengguna ini akan tampil di sini.',
      },
      replies: {
        title: 'Belum ada balasan',
        description: 'Balasan pengguna ini akan tampil di sini.',
      },
      media: {
        title: 'Belum ada media',
        description: 'Post dengan gambar/video akan tampil di sini.',
      },
      likes: {
        title: 'Belum ada like',
        description: 'Post yang disukai pengguna ini akan tampil di sini.',
      },
    }
    return (
      <EmptyState
        icon={MessageSquareText}
        title={emptyMap[tab].title}
        description={emptyMap[tab].description}
      />
    )
  }

  return (
    <div>
      {posts.map((p) => (
        <PostCard
          key={p.id}
          post={p}
          onDelete={(id) => setPosts((prev) => prev.filter((x) => x.id !== id))}
        />
      ))}
      {hasMore && (
        <div className="flex justify-center py-4">
          <Button
            variant="ghost"
            onClick={loadMore}
            disabled={loadingMore}
            className="rounded-full text-primary"
          >
            {loadingMore ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Muat lebih banyak
          </Button>
        </div>
      )}
    </div>
  )
}

function ProfileSkeleton() {
  return (
    <div>
      <div className="h-32 sm:h-48 w-full bg-muted animate-pulse" />
      <div className="px-4 -mt-12 sm:-mt-16">
        <div className="flex items-end justify-between">
          <div className="h-24 w-24 sm:h-32 sm:w-32 rounded-full bg-muted ring-4 ring-background animate-pulse" />
          <div className="h-9 w-28 bg-muted rounded-full animate-pulse mb-1" />
        </div>
        <div className="mt-3 space-y-2">
          <div className="h-5 w-40 bg-muted rounded animate-pulse" />
          <div className="h-3 w-24 bg-muted rounded animate-pulse" />
        </div>
        <div className="mt-3 space-y-2">
          <div className="h-3 w-full bg-muted rounded animate-pulse" />
          <div className="h-3 w-3/4 bg-muted rounded animate-pulse" />
        </div>
        <div className="mt-4 flex gap-4">
          <div className="h-3 w-20 bg-muted rounded animate-pulse" />
          <div className="h-3 w-24 bg-muted rounded animate-pulse" />
        </div>
      </div>
      <div className="mt-6">
        <FeedSkeleton count={4} />
      </div>
    </div>
  )
}
