'use client'

import { useState, useEffect, useCallback } from 'react'
import { Users, Plus, Hash, Loader2, Sparkles, Crown, Shield } from 'lucide-react'
import { useViewStore } from '@/stores/app-store'
import { useApi, apiPost, apiDelete } from '@/lib/hooks'
import { ViewHeader, EmptyState, LoadingState, ErrorState } from '@/components/shared-states'
import { UserAvatar } from '@/components/user-avatar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import { formatCount } from '@/lib/api'
import { slugify } from '@/lib/utils'
import type { CommunityDTO, AuthorDTO } from '@/lib/types'

interface CommunitiesResponse {
  communities: CommunityDTO[]
}

interface CommunityDetailResponse {
  community: CommunityDTO
  members: AuthorDTO[]
}

// ── Slug → deterministic gradient ─────────────
// Hash a string → two HSL hues → produce a `linear-gradient(...)` string.
function slugGradient(slug: string): string {
  let h = 0
  for (let i = 0; i < slug.length; i++) {
    h = (h * 31 + slug.charCodeAt(i)) >>> 0
  }
  const hue1 = h % 360
  const hue2 = (hue1 + 60) % 360
  // Avoid blue/indigo per design rules — shift anything in the 200–260 range
  const safe = (hue: number) => (hue >= 200 && hue <= 260 ? (hue + 120) % 360 : hue)
  return `linear-gradient(135deg, hsl(${safe(hue1)} 70% 55%), hsl(${safe(hue2)} 65% 45%))`
}

export function CommunitiesView() {
  const { data, loading, error, refetch, setData } = useApi<CommunitiesResponse>('/api/communities', {})
  const [createOpen, setCreateOpen] = useState(false)
  const [detailId, setDetailId] = useState<string | null>(null)

  return (
    <>
      <ViewHeader
        title="Communities"
        subtitle="Temukan dan gabung komunitas"
        rightSlot={
          <Button
            size="sm"
            className="rounded-full font-semibold"
            onClick={() => setCreateOpen(true)}
          >
            <Plus className="h-4 w-4 mr-1" /> Buat
          </Button>
        }
      />

      {loading ? (
        <CommunitiesGridSkeleton />
      ) : error ? (
        <ErrorState message={error} onRetry={refetch} />
      ) : !data || data.communities.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Belum ada komunitas"
          description="Jadilah yang pertama membuat komunitas di Twivter."
          action={{ label: 'Buat komunitas', onClick: () => setCreateOpen(true) }}
        />
      ) : (
        <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {data.communities.map((c) => (
            <CommunityCard
              key={c.id}
              community={c}
              onOpenDetail={() => setDetailId(c.id)}
              onMembershipChanged={(membership, count) => {
                setData((prev) =>
                  prev
                    ? {
                        communities: prev.communities.map((x) =>
                          x.id === c.id
                            ? { ...x, isMember: membership, membersCount: count }
                            : x
                        ),
                      }
                    : prev
                )
              }}
            />
          ))}
        </div>
      )}

      <CreateCommunityDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={(newCommunity) => {
          setCreateOpen(false)
          setData((prev) =>
            prev
              ? { communities: [newCommunity, ...prev.communities] }
              : { communities: [newCommunity] }
          )
          toast.success(`Komunitas "${newCommunity.name}" berhasil dibuat! 🎉`)
        }}
      />

      <CommunityDetailDialog
        communityId={detailId}
        onOpenChange={(open) => !open && setDetailId(null)}
        onMembershipChanged={(id, membership, count) => {
          setData((prev) =>
            prev
              ? {
                  communities: prev.communities.map((x) =>
                    x.id === id ? { ...x, isMember: membership, membersCount: count } : x
                  ),
                }
              : prev
          )
        }}
      />
    </>
  )
}

function CommunitiesGridSkeleton() {
  return (
    <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <Card key={i} className="overflow-hidden p-0 gap-0">
          <Skeleton className="h-24 w-full rounded-none" />
          <div className="p-4 space-y-3">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
            <Skeleton className="h-9 w-full rounded-full" />
          </div>
        </Card>
      ))}
    </div>
  )
}

function CommunityCard({
  community: c,
  onOpenDetail,
  onMembershipChanged,
}: {
  community: CommunityDTO
  onOpenDetail: () => void
  onMembershipChanged: (isMember: boolean, membersCount: number) => void
}) {
  const [isMember, setIsMember] = useState(c.isMember)
  const [membersCount, setMembersCount] = useState(c.membersCount)
  const [busy, setBusy] = useState(false)

  // Keep local state in sync if the parent's data updates (e.g. from detail dialog)
  useEffect(() => {
    setIsMember(c.isMember)
    setMembersCount(c.membersCount)
  }, [c.isMember, c.membersCount])

  const toggleJoin = async (e: React.MouseEvent) => {
    e.stopPropagation()
    setBusy(true)
    const was = isMember
    try {
      if (was) {
        const res = await apiDelete<{ isMember: boolean; membersCount: number }>(
          `/api/communities/${c.id}/join`
        )
        setIsMember(res.isMember)
        setMembersCount(res.membersCount)
        onMembershipChanged(res.isMember, res.membersCount)
        toast.success(`Anda keluar dari ${c.name}`)
      } else {
        const res = await apiPost<{ isMember: boolean; membersCount: number }>(
          `/api/communities/${c.id}/join`
        )
        setIsMember(res.isMember)
        setMembersCount(res.membersCount)
        onMembershipChanged(res.isMember, res.membersCount)
        toast.success(`Bergabung dengan ${c.name} 🎉`)
      }
    } catch (e: any) {
      setIsMember(was)
      toast.error(e?.message || 'Gagal memperbarui keanggotaan')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="overflow-hidden p-0 gap-0 shadow-sm hover:shadow-md transition-shadow flex flex-col">
      {/* Cover (clickable — opens detail dialog) */}
      <button
        onClick={onOpenDetail}
        className="block w-full h-24 relative overflow-hidden"
        style={{ background: c.coverUrl ? undefined : slugGradient(c.slug) }}
        aria-label={`Buka detail ${c.name}`}
      >
        {c.coverUrl ? (
          <img
            src={c.coverUrl}
            alt={c.name}
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-white/85">
            <Hash className="h-8 w-8" />
          </div>
        )}
      </button>

      {/* Body (clickable — opens detail dialog) */}
      <button
        onClick={onOpenDetail}
        className="flex-1 p-4 space-y-3 text-left"
      >
        <div className="min-w-0">
          <h3 className="font-bold text-base truncate">{c.name}</h3>
          <p className="text-xs text-muted-foreground truncate">@{c.slug}</p>
        </div>
        {c.description ? (
          <p className="text-sm text-muted-foreground line-clamp-2">{c.description}</p>
        ) : (
          <p className="text-sm text-muted-foreground italic line-clamp-2">
            Belum ada deskripsi
          </p>
        )}
        <div className="flex items-center gap-2 min-w-0">
          <UserAvatar
            username={c.owner.username}
            displayName={c.owner.displayName}
            avatarUrl={c.owner.avatarUrl}
            verified={c.owner.verified}
            size="xs"
            showVerified={false}
          />
          <span className="text-xs text-muted-foreground truncate">
            @{c.owner.username}
          </span>
          <span className="text-xs text-muted-foreground">·</span>
          <span className="text-xs text-muted-foreground shrink-0">
            {formatCount(membersCount)} anggota
          </span>
        </div>
      </button>

      {/* Footer — Join button (does not open detail) */}
      <div className="px-4 pb-4">
        <Button
          variant={isMember ? 'outline' : 'default'}
          className="w-full rounded-full font-semibold"
          onClick={toggleJoin}
          disabled={busy}
        >
          {busy ? (
            <>
              <Loader2 className="h-4 w-4 mr-1 animate-spin" /> Memproses...
            </>
          ) : isMember ? (
            'Bergabung'
          ) : (
            <>
              <Plus className="h-4 w-4 mr-1" /> Gabung
            </>
          )}
        </Button>
      </div>
    </Card>
  )
}

// ── Detail Dialog (with member list) ──────────
function CommunityDetailDialog({
  communityId,
  onOpenChange,
  onMembershipChanged,
}: {
  communityId: string | null
  onOpenChange: (open: boolean) => void
  onMembershipChanged: (id: string, isMember: boolean, membersCount: number) => void
}) {
  return (
    <Dialog open={!!communityId} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-hidden flex flex-col">
        {communityId && (
          <CommunityDetailBody
            communityId={communityId}
            onMembershipChanged={onMembershipChanged}
            onOpenChange={onOpenChange}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function CommunityDetailBody({
  communityId,
  onMembershipChanged,
  onOpenChange,
}: {
  communityId: string
  onMembershipChanged: (id: string, isMember: boolean, membersCount: number) => void
  onOpenChange: (open: boolean) => void
}) {
  const navigate = useViewStore((s) => s.navigate)
  const { data, loading, error, refetch } = useApi<CommunityDetailResponse>(
    `/api/communities/${communityId}`,
    {}
  )
  const [isMember, setIsMember] = useState(false)
  const [membersCount, setMembersCount] = useState(0)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (data) {
      setIsMember(data.community.isMember)
      setMembersCount(data.community.membersCount)
    }
  }, [data])

  const toggleJoin = useCallback(async () => {
    if (!data) return
    setBusy(true)
    const was = isMember
    try {
      if (was) {
        const res = await apiDelete<{ isMember: boolean; membersCount: number }>(
          `/api/communities/${data.community.id}/join`
        )
        setIsMember(res.isMember)
        setMembersCount(res.membersCount)
        onMembershipChanged(data.community.id, res.isMember, res.membersCount)
        toast.success(`Anda keluar dari ${data.community.name}`)
        // Also refetch on leave, otherwise the member list still shows you.
        refetch()
      } else {
        const res = await apiPost<{ isMember: boolean; membersCount: number }>(
          `/api/communities/${data.community.id}/join`
        )
        setIsMember(res.isMember)
        setMembersCount(res.membersCount)
        onMembershipChanged(data.community.id, res.isMember, res.membersCount)
        toast.success(`Bergabung dengan ${data.community.name} 🎉`)
        refetch()
      }
    } catch (e: any) {
      setIsMember(was)
      toast.error(e?.message || 'Gagal memperbarui keanggotaan')
    } finally {
      setBusy(false)
    }
  }, [data, isMember, onMembershipChanged, refetch])

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-24 w-full rounded-lg" />
        <Skeleton className="h-5 w-2/3" />
        <Skeleton className="h-3 w-1/2" />
        <Skeleton className="h-9 w-full rounded-full" />
        <div className="space-y-2 pt-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 py-2">
              <Skeleton className="h-9 w-9 rounded-full" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-2.5 w-20" />
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6">
        <ErrorState message={error} onRetry={refetch} />
      </div>
    )
  }

  if (!data) return null
  const c = data.community

  return (
    <>
      <div className="relative">
        {/* Cover */}
        <div
          className="h-28 w-full rounded-t-lg relative overflow-hidden"
          style={{ background: c.coverUrl ? undefined : slugGradient(c.slug) }}
        >
          {c.coverUrl && (
            <img
              src={c.coverUrl}
              alt={c.name}
              className="absolute inset-0 w-full h-full object-cover"
            />
          )}
          {!c.coverUrl && (
            <div className="absolute inset-0 flex items-center justify-center text-white/85">
              <Hash className="h-10 w-10" />
            </div>
          )}
        </div>
        <button
          onClick={() => navigate('profile', { profileUsername: c.owner.username })}
          className="absolute -bottom-6 right-4 flex items-center gap-2 px-2.5 py-1 rounded-full bg-background border border-border shadow-sm"
          title={`Pemilik: @${c.owner.username}`}
        >
          <UserAvatar
            username={c.owner.username}
            displayName={c.owner.displayName}
            avatarUrl={c.owner.avatarUrl}
            verified={c.owner.verified}
            size="xs"
            showVerified={false}
          />
          <span className="text-xs font-medium">@{c.owner.username}</span>
          <Crown className="h-3.5 w-3.5 text-amber-500" />
        </button>
      </div>

      <div className="px-6 pt-8 pb-2 overflow-y-auto scrollbar-thin">
        <DialogHeader className="space-y-1 mb-3">
          <DialogTitle className="text-xl">{c.name}</DialogTitle>
          <DialogDescription className="text-xs">
            @{c.slug} · {formatCount(membersCount)} anggota
          </DialogDescription>
        </DialogHeader>

        {c.description ? (
          <p className="text-sm text-foreground/90 mb-4 whitespace-pre-wrap">{c.description}</p>
        ) : (
          <p className="text-sm text-muted-foreground italic mb-4">
            Belum ada deskripsi untuk komunitas ini.
          </p>
        )}

        <Button
          variant={isMember ? 'outline' : 'default'}
          className="w-full rounded-full font-semibold mb-5"
          onClick={toggleJoin}
          disabled={busy}
        >
          {busy ? (
            <>
              <Loader2 className="h-4 w-4 mr-1 animate-spin" /> Memproses...
            </>
          ) : isMember ? (
            'Bergabung'
          ) : (
            <>
              <Plus className="h-4 w-4 mr-1" /> Gabung Komunitas
            </>
          )}
        </Button>

        {/* Members */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-semibold">Anggota</h4>
            <span className="text-xs text-muted-foreground">
              {formatCount(membersCount)} total
            </span>
          </div>
          {data.members.length === 0 ? (
            <p className="text-xs text-muted-foreground py-3">
              Belum ada anggota lain.
            </p>
          ) : (
            <ul className="divide-y divide-border max-h-72 overflow-y-auto scrollbar-thin -mx-1">
              {data.members.map((m) => (
                <li key={m.id}>
                  <button
                    onClick={() => {
                      onOpenChange(false)
                      navigate('profile', { profileUsername: m.username })
                    }}
                    className="w-full px-1 py-2.5 flex items-center gap-3 hover:bg-muted/50 rounded-md transition-colors text-left"
                  >
                    <UserAvatar
                      username={m.username}
                      displayName={m.displayName}
                      avatarUrl={m.avatarUrl}
                      verified={m.verified}
                      size="sm"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold truncate">{m.displayName}</div>
                      <div className="text-xs text-muted-foreground truncate">@{m.username}</div>
                    </div>
                    {m.id === c.owner.id && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-600 bg-amber-500/10 px-2 py-0.5 rounded-full">
                        <Crown className="h-3 w-3" /> Owner
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <DialogFooter className="px-6 pb-4 pt-1">
        <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
          <Shield className="h-3 w-3" /> Komunitas dibuat{' '}
          {new Date(c.createdAt).toLocaleDateString('id-ID', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
          })}
        </p>
      </DialogFooter>
    </>
  )
}

// ── Create Community Dialog ───────────────────
function CreateCommunityDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  onCreated: (c: CommunityDTO) => void
}) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [busy, setBusy] = useState(false)

  const liveSlug = slugify(name) || 'slug-otomatis'

  const reset = () => {
    setName('')
    setDescription('')
  }

  const submit = async () => {
    if (name.trim().length < 3) {
      toast.error('Nama komunitas minimal 3 karakter')
      return
    }
    setBusy(true)
    try {
      const res = await apiPost<{ community: CommunityDTO }>('/api/communities', {
        name: name.trim(),
        description: description.trim() || undefined,
      })
      reset()
      onCreated(res.community)
    } catch (e: any) {
      toast.error(e?.message || 'Gagal membuat komunitas')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset()
        onOpenChange(v)
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" /> Buat Komunitas
          </DialogTitle>
          <DialogDescription>
            Komunitas adalah tempat untuk berdiskusi topik tertentu dengan orang yang share minat
            yang sama.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="community-name">Nama Komunitas</Label>
            <Input
              id="community-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="cth: Penggemar Kopi Nusantara"
              maxLength={60}
              autoFocus
            />
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="text-muted-foreground">{name.length}/60 karakter</span>
              <span className="text-muted-foreground">Minimal 3 karakter</span>
            </div>
          </div>

          {/* Live slug preview */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Slug URL (otomatis)</Label>
            <div className="rounded-md border border-dashed border-border bg-muted/40 px-3 py-2 text-sm">
              <span className="text-muted-foreground">/communities/</span>
              <span className="font-medium text-foreground break-all">{liveSlug}</span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Slug unik akan digenerate otomatis dari nama. Jika sudah dipakai, suffix akan
              ditambahkan (cth: <code>{liveSlug}-2</code>).
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="community-desc">Deskripsi (opsional)</Label>
            <Textarea
              id="community-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Jelaskan tentang komunitas ini..."
              rows={3}
              maxLength={280}
            />
            <p className="text-xs text-muted-foreground">{description.length}/280 karakter</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Batal
          </Button>
          <Button onClick={submit} disabled={busy || name.trim().length < 3}>
            {busy ? (
              <>
                <Loader2 className="h-4 w-4 mr-1 animate-spin" /> Membuat...
              </>
            ) : (
              'Buat Komunitas'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
