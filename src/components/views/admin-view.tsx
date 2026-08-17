'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import {
  Shield,
  Users as UsersIcon,
  FileText,
  Flag,
  BadgeCheck,
  TrendingUp,
  Search,
  CheckCircle2,
  XCircle,
  ArrowRight,
  Inbox,
  ShieldCheck,
} from 'lucide-react'
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts'
import { useAuthStore, useViewStore } from '@/stores/app-store'
import { ViewHeader, EmptyState, ErrorState } from '@/components/shared-states'
import { UserAvatar } from '@/components/user-avatar'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { apiPatch } from '@/lib/hooks'
import { timeAgo } from '@/lib/api'
import { cn } from '@/lib/utils'
import type { ProfileDTO, AuthorDTO } from '@/lib/types'

// ─── Types ───────────────────────────────────────
interface AdminStats {
  users: number
  posts: number
  comments: number
  likes: number
  communities: number
  conversations: number
  reports: { pending: number; resolved: number }
  verifications: { pending: number }
  growth: { date: string; users: number; posts: number }[]
}

interface AdminReport {
  id: string
  reporter: AuthorDTO
  target: AuthorDTO
  targetType: string
  reason: string
  status: string
  createdAt: string
}

interface AdminVerification {
  id: string
  user: ProfileDTO
  reason: string
  status: string
  createdAt: string
}

type AdminTab = 'reports' | 'verifications' | 'users'

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30',
  reviewed: 'bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30',
  resolved: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
  dismissed: 'bg-zinc-500/15 text-zinc-700 dark:text-zinc-300 border-zinc-500/30',
  approved: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
  rejected: 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30',
}

const STATUS_LABEL: Record<string, string> = {
  pending: 'Menunggu',
  reviewed: 'Ditinjau',
  resolved: 'Selesai',
  dismissed: 'Ditolak',
  approved: 'Disetujui',
  rejected: 'Ditolak',
}

// ─── Main ─────────────────────────────────────────
export function AdminView() {
  const user = useAuthStore((s) => s.user)
  const [tab, setTab] = useState<AdminTab>('reports')
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [statsLoading, setStatsLoading] = useState(true)
  const [statsError, setStatsError] = useState<string | null>(null)

  const fetchStats = useCallback(async () => {
    setStatsLoading(true)
    setStatsError(null)
    try {
      const res = await fetch('/api/admin/stats', { cache: 'no-store' })
      if (!res.ok) {
        const e = await res.json().catch(() => ({}))
        throw new Error((e as any).error || `HTTP ${res.status}`)
      }
      const json = await res.json()
      setStats(json)
    } catch (e: any) {
      setStatsError(e.message || 'Gagal memuat statistik')
    } finally {
      setStatsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchStats()
  }, [fetchStats])

  // Gate: only admins can see this view
  if (!user || user.role !== 'admin') {
    return (
      <>
        <ViewHeader title="Admin Dashboard" showBack />
        <EmptyState
          icon={Shield}
          title="Akses ditolak"
          description="Halaman ini khusus admin. Hubungi admin sistem jika kamu merasa ini seharusnya bisa diakses."
        />
      </>
    )
  }

  return (
    <div className="min-h-screen flex flex-col">
      <ViewHeader
        title="Admin Dashboard"
        subtitle="Moderasi & statistik platform"
        showBack
        rightSlot={
          <div className="hidden sm:flex items-center gap-2 pr-2">
            <Shield className="h-4 w-4 text-primary" />
            <Badge variant="secondary" className="text-xs">
              {user.username}
            </Badge>
          </div>
        }
      />

      <div className="flex-1 px-4 py-6 md:px-6 max-w-6xl mx-auto w-full space-y-6">
        {/* Stats cards */}
        {statsLoading ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-28 rounded-xl" />
            ))}
          </div>
        ) : statsError ? (
          <ErrorState message={statsError} onRetry={fetchStats} />
        ) : stats ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard
              icon={UsersIcon}
              label="Total pengguna"
              value={stats.users}
              color="from-sky-500/15 to-sky-500/5 text-sky-600 dark:text-sky-400"
              trend={`${stats.growth.reduce((a, b) => a + b.users, 0)} baru 7 hari`}
            />
            <StatCard
              icon={FileText}
              label="Total post"
              value={stats.posts}
              color="from-violet-500/15 to-violet-500/5 text-violet-600 dark:text-violet-400"
              trend={`${stats.growth.reduce((a, b) => a + b.posts, 0)} baru 7 hari`}
            />
            <button
              onClick={() => setTab('reports')}
              className="text-left"
              aria-label="Buka tab laporan"
            >
              <StatCard
                icon={Flag}
                label="Laporan pending"
                value={stats.reports.pending}
                color="from-amber-500/15 to-amber-500/5 text-amber-600 dark:text-amber-400"
                trend={`${stats.reports.resolved} selesai`}
                clickable
              />
            </button>
            <button
              onClick={() => setTab('verifications')}
              className="text-left"
              aria-label="Buka tab verifikasi"
            >
              <StatCard
                icon={BadgeCheck}
                label="Verifikasi pending"
                value={stats.verifications.pending}
                color="from-emerald-500/15 to-emerald-500/5 text-emerald-600 dark:text-emerald-400"
                trend="Menunggu review"
                clickable
              />
            </button>
          </div>
        ) : null}

        {/* Growth chart */}
        <Card className="p-4 md:p-6">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="h-4 w-4 text-primary" />
            <h3 className="font-semibold text-sm">Pertumbuhan 7 hari terakhir</h3>
          </div>
          {statsLoading ? (
            <Skeleton className="h-56 w-full rounded-lg" />
          ) : stats ? (
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={stats.growth}
                  margin={{ top: 5, right: 12, bottom: 0, left: -16 }}
                >
                  <defs>
                    <linearGradient id="g-users" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.6} />
                      <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="g-posts" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.6} />
                      <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-border" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(d) => {
                      const date = new Date(d)
                      return date.toLocaleDateString('id-ID', {
                        day: 'numeric',
                        month: 'short',
                      })
                    }}
                    tick={{ fontSize: 11 }}
                    stroke="currentColor"
                    className="text-muted-foreground"
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fontSize: 11 }}
                    stroke="currentColor"
                    className="text-muted-foreground"
                  />
                  <Tooltip
                    contentStyle={{
                      background: 'hsl(var(--popover))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                    labelFormatter={(d) => {
                      const date = new Date(d as string)
                      return date.toLocaleDateString('id-ID', {
                        weekday: 'short',
                        day: 'numeric',
                        month: 'long',
                      })
                    }}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: 12 }}
                    formatter={(v) =>
                      v === 'users' ? 'Pengguna baru' : 'Post baru'
                    }
                  />
                  <Area
                    type="monotone"
                    dataKey="users"
                    stroke="#3B82F6"
                    strokeWidth={2}
                    fill="url(#g-users)"
                    name="users"
                  />
                  <Area
                    type="monotone"
                    dataKey="posts"
                    stroke="#8B5CF6"
                    strokeWidth={2}
                    fill="url(#g-posts)"
                    name="posts"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-8 text-center">
              Statistik belum tersedia.
            </p>
          )}
        </Card>

        {/* Tabs */}
        <Tabs value={tab} onValueChange={(v) => setTab(v as AdminTab)}>
          <TabsList className="w-full justify-start overflow-x-auto">
            <TabsTrigger value="reports" className="gap-1.5">
              <Flag className="h-3.5 w-3.5" /> Laporan
            </TabsTrigger>
            <TabsTrigger value="verifications" className="gap-1.5">
              <BadgeCheck className="h-3.5 w-3.5" /> Verifikasi
            </TabsTrigger>
            <TabsTrigger value="users" className="gap-1.5">
              <UsersIcon className="h-3.5 w-3.5" /> Pengguna
            </TabsTrigger>
          </TabsList>

          <TabsContent value="reports">
            <ReportsTab onResolveChange={fetchStats} />
          </TabsContent>
          <TabsContent value="verifications">
            <VerificationsTab onVerdictChange={fetchStats} />
          </TabsContent>
          <TabsContent value="users">
            <UsersTab />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

// ─── Stat card ────────────────────────────────────
function StatCard({
  icon: Icon,
  label,
  value,
  color,
  trend,
  clickable,
}: {
  icon: typeof UsersIcon
  label: string
  value: number
  color: string
  trend?: string
  clickable?: boolean
}) {
  return (
    <div
      className={cn(
        'rounded-xl border bg-gradient-to-br p-4 transition-all',
        color,
        clickable && 'hover:shadow-md hover:-translate-y-0.5'
      )}
    >
      <div className="flex items-start justify-between">
        <Icon className="h-5 w-5 opacity-80" />
        {clickable && (
          <ArrowRight className="h-3.5 w-3.5 opacity-50" />
        )}
      </div>
      <p className="text-2xl font-bold mt-3 tabular-nums">{value}</p>
      <p className="text-xs font-medium opacity-80">{label}</p>
      {trend && <p className="text-[10px] opacity-60 mt-1">{trend}</p>}
    </div>
  )
}

// ─── Reports tab ─────────────────────────────────
function ReportsTab({ onResolveChange }: { onResolveChange: () => void }) {
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'reviewed' | 'resolved' | 'dismissed'>('all')
  const [reports, setReports] = useState<AdminReport[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionPending, setActionPending] = useState<Set<string>>(new Set())

  const fetchReports = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const url =
        statusFilter === 'all'
          ? '/api/admin/reports'
          : `/api/admin/reports?status=${statusFilter}`
      const res = await fetch(url, { cache: 'no-store' })
      if (!res.ok) {
        const e = await res.json().catch(() => ({}))
        throw new Error((e as any).error || `HTTP ${res.status}`)
      }
      const json = await res.json()
      setReports(json.reports ?? [])
    } catch (e: any) {
      setError(e.message || 'Gagal memuat laporan')
    } finally {
      setLoading(false)
    }
  }, [statusFilter])

  useEffect(() => {
    fetchReports()
  }, [fetchReports])

  const patchReport = async (id: string, status: 'reviewed' | 'resolved' | 'dismissed') => {
    setActionPending((p) => new Set(p).add(id))
    try {
      await apiPatch(`/api/admin/reports/${id}`, { status })
      toast.success(`Laporan ${STATUS_LABEL[status].toLowerCase()}`)
      setReports((prev) => prev.filter((r) => r.id !== id))
      onResolveChange()
    } catch (e: any) {
      toast.error(e.message || 'Gagal memperbarui laporan')
    } finally {
      setActionPending((p) => {
        const next = new Set(p)
        next.delete(id)
        return next
      })
    }
  }

  return (
    <Card className="p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h3 className="font-semibold text-sm">Laporan pengguna</h3>
        <Select
          value={statusFilter}
          onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}
        >
          <SelectTrigger className="w-40 h-8 text-xs">
            <SelectValue placeholder="Semua status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua status</SelectItem>
            <SelectItem value="pending">Menunggu</SelectItem>
            <SelectItem value="reviewed">Ditinjau</SelectItem>
            <SelectItem value="resolved">Selesai</SelectItem>
            <SelectItem value="dismissed">Ditolak</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-lg" />
          ))}
        </div>
      ) : error ? (
        <ErrorState message={error} onRetry={fetchReports} />
      ) : reports.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title="Tidak ada laporan"
          description="Saat ini tidak ada laporan dengan status ini."
        />
      ) : (
        <ul className="space-y-3 max-h-[640px] overflow-y-auto pr-1 twivter-scroll">
          {reports.map((r) => (
            <li
              key={r.id}
              className="rounded-lg border border-border p-3 md:p-4 space-y-3"
            >
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className={cn('border', STATUS_COLORS[r.status])}>
                  {STATUS_LABEL[r.status] ?? r.status}
                </Badge>
                <Badge variant="secondary" className="text-xs">
                  {r.targetType === 'post' ? 'Post' : 'Pengguna'}
                </Badge>
                <span className="text-xs text-muted-foreground ml-auto">
                  {timeAgo(r.createdAt)}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold w-16 shrink-0">
                    Pelapor
                  </span>
                  <AuthorChip author={r.reporter} />
                </div>
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold w-16 shrink-0">
                    Target
                  </span>
                  <AuthorChip author={r.target} />
                </div>
              </div>

              <div>
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold mb-0.5">
                  Alasan
                </p>
                <p className="text-sm">{r.reason}</p>
              </div>

              {r.status === 'pending' && (
                <div className="flex flex-wrap gap-2 pt-1">
                  <Button
                    size="sm"
                    variant="default"
                    className="h-7 text-xs"
                    disabled={actionPending.has(r.id)}
                    onClick={() => patchReport(r.id, 'resolved')}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                    Selesaikan
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    disabled={actionPending.has(r.id)}
                    onClick={() => patchReport(r.id, 'reviewed')}
                  >
                    Ditinjau
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs text-muted-foreground"
                    disabled={actionPending.has(r.id)}
                    onClick={() => patchReport(r.id, 'dismissed')}
                  >
                    <XCircle className="h-3.5 w-3.5 mr-1" />
                    Tolak
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

function AuthorChip({ author }: { author: AuthorDTO }) {
  const navigate = useViewStore((s) => s.navigate)
  return (
    <button
      onClick={() => navigate('profile', { profileUsername: author.username })}
      className="flex items-center gap-2 min-w-0 hover:bg-muted rounded-md p-1 -m-1 transition-colors"
    >
      <UserAvatar
        username={author.username}
        displayName={author.displayName}
        avatarUrl={author.avatarUrl}
        verified={author.verified}
        size="xs"
      />
      <span className="text-sm font-medium truncate">{author.displayName}</span>
      <span className="text-xs text-muted-foreground truncate">
        @{author.username}
      </span>
    </button>
  )
}

// ─── Verifications tab ────────────────────────────
function VerificationsTab({ onVerdictChange }: { onVerdictChange: () => void }) {
  const [requests, setRequests] = useState<AdminVerification[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState<Set<string>>(new Set())

  const fetchReqs = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/verifications', { cache: 'no-store' })
      if (!res.ok) {
        const e = await res.json().catch(() => ({}))
        throw new Error((e as any).error || `HTTP ${res.status}`)
      }
      const json = await res.json()
      setRequests(json.requests ?? [])
    } catch (e: any) {
      setError(e.message || 'Gagal memuat permintaan verifikasi')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchReqs()
  }, [fetchReqs])

  const decide = async (id: string, status: 'approved' | 'rejected') => {
    setPending((p) => new Set(p).add(id))
    try {
      await apiPatch(`/api/admin/verifications/${id}`, { status })
      toast.success(
        status === 'approved'
          ? 'Verifikasi disetujui — akun sekarang terverifikasi'
          : 'Permintaan verifikasi ditolak'
      )
      setRequests((prev) => prev.filter((r) => r.id !== id))
      onVerdictChange()
    } catch (e: any) {
      toast.error(e.message || 'Gagal memproses verifikasi')
    } finally {
      setPending((p) => {
        const next = new Set(p)
        next.delete(id)
        return next
      })
    }
  }

  return (
    <Card className="p-4 md:p-6">
      <h3 className="font-semibold text-sm mb-4">Permintaan verifikasi</h3>
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-lg" />
          ))}
        </div>
      ) : error ? (
        <ErrorState message={error} onRetry={fetchReqs} />
      ) : requests.length === 0 ? (
        <EmptyState
          icon={BadgeCheck}
          title="Tidak ada permintaan"
          description="Belum ada permintaan verifikasi yang menunggu."
        />
      ) : (
        <ul className="space-y-3 max-h-[640px] overflow-y-auto pr-1 twivter-scroll">
          {requests.map((v) => (
            <li
              key={v.id}
              className="rounded-lg border border-border p-3 md:p-4 space-y-3"
            >
              <div className="flex items-start gap-3">
                <UserAvatar
                  username={v.user.username}
                  displayName={v.user.displayName}
                  avatarUrl={v.user.avatarUrl}
                  verified={v.user.verified}
                  size="md"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold truncate">
                      {v.user.displayName}
                    </span>
                    {v.user.verified && (
                      <BadgeCheck className="h-4 w-4 text-primary" />
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    @{v.user.username}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {v.user.followersCount.toLocaleString('id-ID')} pengikut ·{' '}
                    {v.user.postsCount.toLocaleString('id-ID')} post ·{' '}
                    {timeAgo(v.user.createdAt)} bergabung
                  </p>
                </div>
                <span className="text-xs text-muted-foreground shrink-0">
                  {timeAgo(v.createdAt)}
                </span>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold mb-0.5">
                  Alasan
                </p>
                <p className="text-sm">{v.reason}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="default"
                  className="h-7 text-xs"
                  disabled={pending.has(v.id)}
                  onClick={() => decide(v.id, 'approved')}
                >
                  <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                  Setujui
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  disabled={pending.has(v.id)}
                  onClick={() => decide(v.id, 'rejected')}
                >
                  <XCircle className="h-3.5 w-3.5 mr-1" />
                  Tolak
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

// ─── Users tab ────────────────────────────────────
function UsersTab() {
  const [q, setQ] = useState('')
  const [roleFilter, setRoleFilter] = useState<'all' | 'user' | 'admin'>('all')
  const [users, setUsers] = useState<ProfileDTO[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState<Set<string>>(new Set())
  const currentUser = useAuthStore((s) => s.user)

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (q) params.set('q', q)
      if (roleFilter !== 'all') params.set('role', roleFilter)
      const url = `/api/admin/users${params.toString() ? `?${params}` : ''}`
      const res = await fetch(url, { cache: 'no-store' })
      if (!res.ok) {
        const e = await res.json().catch(() => ({}))
        throw new Error((e as any).error || `HTTP ${res.status}`)
      }
      const json = await res.json()
      setUsers(json.users ?? [])
    } catch (e: any) {
      setError(e.message || 'Gagal memuat pengguna')
    } finally {
      setLoading(false)
    }
  }, [q, roleFilter])

  // Debounced fetch: also runs on mount (initial load)
  useEffect(() => {
    const t = setTimeout(() => {
      fetchUsers()
    }, 300)
    return () => clearTimeout(t)
  }, [fetchUsers])

  const updateUserField = async (
    id: string,
    field: 'role' | 'verified',
    value: boolean | string
  ) => {
    setPending((p) => new Set(p).add(id))
    const prev = users
    // optimistic
    setUsers((us) =>
      us.map((u) => (u.id === id ? { ...u, [field]: value } : u))
    )
    try {
      await apiPatch(`/api/admin/users/${id}`, { [field]: value })
      toast.success('Pengguna diperbarui')
    } catch (e: any) {
      // revert
      setUsers(prev)
      toast.error(e.message || 'Gagal memperbarui pengguna')
    } finally {
      setPending((p) => {
        const next = new Set(p)
        next.delete(id)
        return next
      })
    }
  }

  return (
    <Card className="p-4 md:p-6">
      <h3 className="font-semibold text-sm mb-4">Kelola pengguna</h3>

      <div className="flex flex-wrap gap-2 mb-4">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Cari nama, username, atau email..."
            className="pl-8 h-9"
          />
        </div>
        <Select
          value={roleFilter}
          onValueChange={(v) => setRoleFilter(v as typeof roleFilter)}
        >
          <SelectTrigger className="w-32 h-9 text-xs">
            <SelectValue placeholder="Semua role" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua role</SelectItem>
            <SelectItem value="user">User</SelectItem>
            <SelectItem value="admin">Admin</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-14 rounded-lg" />
          ))}
        </div>
      ) : error ? (
        <ErrorState message={error} onRetry={fetchUsers} />
      ) : users.length === 0 ? (
        <EmptyState
          icon={UsersIcon}
          title="Tidak ada pengguna"
          description="Coba ubah kata kunci pencarian atau filter."
        />
      ) : (
        <ul className="divide-y divide-border max-h-[640px] overflow-y-auto pr-1 twivter-scroll">
          {users.map((u) => {
            const isSelf = currentUser?.id === u.id
            const rowPending = pending.has(u.id)
            return (
              <li
                key={u.id}
                className="py-3 flex items-center gap-3 flex-wrap"
              >
                <button
                  onClick={() =>
                    useViewStore.getState().navigate('profile', {
                      profileUsername: u.username,
                    })
                  }
                  className="flex items-center gap-3 flex-1 min-w-0 hover:opacity-80 transition-opacity"
                >
                  <UserAvatar
                    username={u.username}
                    displayName={u.displayName}
                    avatarUrl={u.avatarUrl}
                    verified={u.verified}
                    size="sm"
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium text-sm truncate">
                        {u.displayName}
                      </span>
                      {u.verified && (
                        <BadgeCheck className="h-3.5 w-3.5 text-primary shrink-0" />
                      )}
                      {isSelf && (
                        <Badge variant="secondary" className="text-[10px] py-0 px-1.5">
                          Kamu
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      @{u.username}
                    </p>
                  </div>
                </button>

                <div className="flex items-center gap-3 shrink-0">
                  <div className="flex items-center gap-2">
                    <ShieldCheck
                      className={cn(
                        'h-4 w-4',
                        u.role === 'admin'
                          ? 'text-primary'
                          : 'text-muted-foreground'
                      )}
                    />
                    <Switch
                      checked={u.role === 'admin'}
                      disabled={isSelf || rowPending}
                      onCheckedChange={(v) =>
                        updateUserField(u.id, 'role', v ? 'admin' : 'user')
                      }
                      aria-label="Toggle admin role"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <BadgeCheck
                      className={cn(
                        'h-4 w-4',
                        u.verified ? 'text-primary' : 'text-muted-foreground'
                      )}
                    />
                    <Switch
                      checked={u.verified}
                      disabled={isSelf || rowPending}
                      onCheckedChange={(v) =>
                        updateUserField(u.id, 'verified', v)
                      }
                      aria-label="Toggle verified status"
                    />
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </Card>
  )
}
