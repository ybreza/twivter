'use client'

import { useState, useEffect, useRef, useCallback, useSyncExternalStore } from 'react'
import { toast } from 'sonner'
import {
  User,
  Palette,
  Heart,
  Bell,
  Lock,
  ShieldCheck,
  Info,
  Check,
  X,
  Loader2,
  LogOut,
  Sun,
  Moon,
  Monitor,
  ExternalLink,
  Github,
  Twitter,
  Sparkles,
  Globe,
} from 'lucide-react'
import { useAuthStore, useThemeStore, useViewStore } from '@/stores/app-store'
import { ViewHeader, LoadingState } from '@/components/shared-states'
import { UserAvatar } from '@/components/user-avatar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { apiPatch, apiPost } from '@/lib/hooks'
import { INTEREST_OPTIONS } from '@/lib/types'
import { safeJsonParse, cn } from '@/lib/utils'
import type { ProfileDTO } from '@/lib/types'

type Section =
  | 'akun'
  | 'tampilan'
  | 'minat'
  | 'notifikasi'
  | 'privasi'
  | 'keamanan'
  | 'tentang'

const SECTIONS: {
  id: Section
  label: string
  icon: typeof User
  desc: string
}[] = [
  { id: 'akun', label: 'Akun', icon: User, desc: 'Profil & informasi akun' },
  { id: 'tampilan', label: 'Tampilan', icon: Palette, desc: 'Tema light/dark/sistem' },
  { id: 'minat', label: 'Minat', icon: Heart, desc: 'Topik yang kamu suka' },
  { id: 'notifikasi', label: 'Notifikasi', icon: Bell, desc: 'Email & push' },
  { id: 'privasi', label: 'Privasi', icon: Lock, desc: 'Visibilitas akun' },
  { id: 'keamanan', label: 'Keamanan', icon: ShieldCheck, desc: 'Password' },
  { id: 'tentang', label: 'Tentang', icon: Info, desc: 'Versi & kredit' },
]

export function SettingsView() {
  const user = useAuthStore((s) => s.user)
  const [section, setSection] = useState<Section>('akun')

  if (!user) {
    return (
      <>
        <ViewHeader title="Pengaturan" showBack />
        <LoadingState message="Memuat pengguna..." />
      </>
    )
  }

  return (
    <div className="min-h-screen flex flex-col">
      <ViewHeader title="Pengaturan" subtitle={`@${user.username}`} showBack />
      <div className="flex-1 w-full max-w-5xl mx-auto md:flex md:gap-8 md:px-6 md:py-6">
        {/* Sub-nav (vertical on desktop, horizontal scroll on mobile) */}
        <nav className="md:w-60 md:shrink-0 border-b md:border-b-0 md:sticky md:top-20 md:self-start">
          <div className="flex md:flex-col gap-1 overflow-x-auto md:overflow-visible px-2 py-2 md:p-0">
            {SECTIONS.map((s) => {
              const Icon = s.icon
              const active = section === s.id
              return (
                <button
                  key={s.id}
                  onClick={() => setSection(s.id)}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors',
                    active
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span>{s.label}</span>
                </button>
              )
            })}
          </div>
        </nav>

        {/* Content */}
        <div className="flex-1 min-w-0 px-4 py-6 md:px-0 md:py-0">
          {section === 'akun' && <AccountSection />}
          {section === 'tampilan' && <AppearanceSection />}
          {section === 'minat' && <InterestsSection />}
          {section === 'notifikasi' && <NotificationsSection />}
          {section === 'privasi' && <PrivacySection />}
          {section === 'keamanan' && <SecuritySection />}
          {section === 'tentang' && <AboutSection />}

          {/* Logout button at the very bottom */}
          <div className="mt-10 pb-8">
            <LogoutButton />
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Section header ──────────────────────────────
function SectionHeader({
  title,
  description,
}: {
  title: string
  description?: string
}) {
  return (
    <div className="mb-6">
      <h2 className="text-xl font-bold">{title}</h2>
      {description && (
        <p className="text-sm text-muted-foreground mt-1">{description}</p>
      )}
    </div>
  )
}

// ─── Akun (Account) ──────────────────────────────
function AccountSection() {
  const user = useAuthStore((s) => s.user)
  const setUser = useAuthStore((s) => s.setUser)

  const [displayName, setDisplayName] = useState(user?.displayName ?? '')
  const [username, setUsername] = useState(user?.username ?? '')
  const [bio, setBio] = useState(user?.bio ?? '')
  const [website, setWebsite] = useState(user?.website ?? '')
  const [location, setLocation] = useState(user?.location ?? '')
  const [saving, setSaving] = useState(false)
  const [usernameStatus, setUsernameStatus] = useState<
    'idle' | 'checking' | 'available' | 'taken' | 'invalid'
  >('idle')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Live username availability check via /api/auth/check-username
  useEffect(() => {
    const trimmed = username.trim()
    if (trimmed === user?.username) {
      setUsernameStatus('idle')
      return
    }
    if (trimmed.length < 3 || !/^[a-zA-Z0-9_]+$/.test(trimmed)) {
      setUsernameStatus('invalid')
      return
    }
    setUsernameStatus('checking')
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/auth/check-username?username=${encodeURIComponent(trimmed)}`
        )
        const json = await res.json()
        if (!json.available) {
          setUsernameStatus(json.reason === 'self' ? 'idle' : 'taken')
        } else {
          setUsernameStatus('available')
        }
      } catch {
        setUsernameStatus('idle')
      }
    }, 400)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [username, user])

  const usernameBlocked =
    usernameStatus === 'checking' ||
    usernameStatus === 'taken' ||
    usernameStatus === 'invalid'

  const dirty =
    displayName !== (user?.displayName ?? '') ||
    username !== (user?.username ?? '') ||
    bio !== (user?.bio ?? '') ||
    website !== (user?.website ?? '') ||
    location !== (user?.location ?? '')

  // The API only accepts an http(s) website, so a bad URL used to save locally
  // and then fail server-side after the click.
  const websiteBlocked = website.trim().length > 0 && !/^https?:\/\/.+/i.test(website.trim())

  const canSave =
    dirty && !usernameBlocked && !websiteBlocked && displayName.trim().length > 0

  const handleSave = async () => {
    if (!user || !canSave) return
    setSaving(true)
    try {
      const updated = await apiPatch<ProfileDTO>('/api/profiles/me', {
        displayName: displayName.trim(),
        username: username.trim(),
        bio: bio.trim(),
        website: website.trim(),
        location: location.trim(),
      })
      // Preserve fields not returned by the profile serializer (email, onboarded, interests)
      setUser({
        ...user,
        displayName: updated.displayName,
        username: updated.username,
        bio: updated.bio,
        website: updated.website,
        location: updated.location,
      })
      toast.success('Profil berhasil diperbarui')
    } catch (e: any) {
      toast.error(e.message || 'Gagal menyimpan profil')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <SectionHeader
        title="Akun"
        description="Kelola profil dan informasi akun kamu."
      />

      <Card className="p-6 space-y-5">
        {/* Preview row */}
        <div className="flex items-center gap-4">
          <UserAvatar
            username={username || user?.username || 'user'}
            displayName={displayName || user?.displayName || 'User'}
            avatarUrl={user?.avatarUrl ?? null}
            verified={user?.verified}
            size="lg"
          />
          <div className="min-w-0">
            <p className="font-semibold truncate">
              {displayName || user?.displayName || 'Tanpa nama'}
            </p>
            <p className="text-sm text-muted-foreground truncate">
              @{username || user?.username}
            </p>
          </div>
        </div>

        <Separator />

        {/* Display name */}
        <div className="space-y-2">
          <Label htmlFor="displayName">Nama tampilan</Label>
          <Input
            id="displayName"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            maxLength={50}
            placeholder="Nama tampilan kamu"
          />
          <p className="text-xs text-muted-foreground">
            {displayName.length}/50
          </p>
        </div>

        {/* Username */}
        <div className="space-y-2">
          <Label htmlFor="username">Username</Label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
              @
            </span>
            <Input
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              maxLength={20}
              className="pl-7 pr-10"
              placeholder="username"
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              {usernameStatus === 'checking' && (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              )}
              {usernameStatus === 'available' && (
                <Check className="h-4 w-4 text-emerald-500" />
              )}
              {(usernameStatus === 'taken' || usernameStatus === 'invalid') && (
                <X className="h-4 w-4 text-destructive" />
              )}
            </div>
          </div>
          {usernameStatus === 'taken' && (
            <p className="text-xs text-destructive">Username sudah digunakan</p>
          )}
          {usernameStatus === 'invalid' && (
            <p className="text-xs text-destructive">
              3-20 karakter, hanya huruf/angka/underscore
            </p>
          )}
          {usernameStatus === 'available' && (
            <p className="text-xs text-emerald-600">Username tersedia</p>
          )}
        </div>

        {/* Bio */}
        <div className="space-y-2">
          <Label htmlFor="bio">Bio</Label>
          <Textarea
            id="bio"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            maxLength={160}
            rows={3}
            placeholder="Ceritakan tentang dirimu"
          />
          <p className="text-xs text-muted-foreground">{bio.length}/160</p>
        </div>

        {/* Location */}
        <div className="space-y-2">
          <Label htmlFor="location">Lokasi</Label>
          <Input
            id="location"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            maxLength={60}
            placeholder="Jakarta, ID"
          />
        </div>

        {/* Website */}
        <div className="space-y-2">
          <Label htmlFor="website">Website</Label>
          <Input
            id="website"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            placeholder="https://example.com"
          />
          {website && !/^https?:\/\/.+/i.test(website.trim()) && (
            <p className="text-xs text-destructive">
              Website harus diawali http:// atau https://
            </p>
          )}
        </div>

        <div className="flex justify-end pt-2">
          <Button onClick={handleSave} disabled={!canSave || saving}>
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Menyimpan...
              </>
            ) : (
              'Simpan perubahan'
            )}
          </Button>
        </div>
      </Card>
    </div>
  )
}

// ─── Tampilan (Appearance) ────────────────────────
function AppearanceSection() {
  const theme = useThemeStore((s) => s.theme)
  const setTheme = useThemeStore((s) => s.setTheme)

  const options: {
    id: 'light' | 'dark' | 'system'
    label: string
    icon: typeof Sun
    desc: string
    preview: string
  }[] = [
    {
      id: 'light',
      label: 'Terang',
      icon: Sun,
      desc: 'Tema terang untuk siang hari',
      preview: 'bg-white border',
    },
    {
      id: 'dark',
      label: 'Gelap',
      icon: Moon,
      desc: 'Tema gelap untuk kenyamanan mata',
      preview: 'bg-slate-900 border-slate-800',
    },
    {
      id: 'system',
      label: 'Sistem',
      icon: Monitor,
      desc: 'Mengikuti preferensi perangkat',
      preview:
        'bg-gradient-to-br from-white via-white to-slate-900 border border-slate-300',
    },
  ]

  return (
    <div>
      <SectionHeader
        title="Tampilan"
        description="Pilih tema yang nyaman untukmu."
      />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {options.map((opt) => {
          const Icon = opt.icon
          const active = theme === opt.id
          return (
            <button
              key={opt.id}
              onClick={() => setTheme(opt.id)}
              className={cn(
                'text-left rounded-xl border-2 p-4 transition-all hover:shadow-md',
                active
                  ? 'border-primary ring-2 ring-primary/20'
                  : 'border-border'
              )}
            >
              <div
                className={cn(
                  'h-20 rounded-lg mb-3 flex items-center justify-center',
                  opt.preview
                )}
              >
                <Icon
                  className={cn(
                    'h-6 w-6',
                    opt.id === 'dark' ? 'text-slate-100' : 'text-slate-700'
                  )}
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="font-semibold">{opt.label}</span>
                {active && (
                  <Check className="h-4 w-4 text-primary" />
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1">{opt.desc}</p>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─── Minat (Interests) ────────────────────────────
function InterestsSection() {
  const user = useAuthStore((s) => s.user)
  const setUser = useAuthStore((s) => s.setUser)

  const initial: string[] = (() => {
    if (!user?.interests) return []
    const parsed = safeJsonParse<string[] | null>(user.interests, null)
    return Array.isArray(parsed) ? parsed : []
  })()

  const [selected, setSelected] = useState<Set<string>>(new Set(initial))
  const [saving, setSaving] = useState(false)

  const dirty =
    selected.size !== initial.length ||
    !initial.every((i) => selected.has(i))

  const toggle = (interest: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(interest)) {
        next.delete(interest)
      } else {
        if (next.size >= 10) {
          toast.error('Maksimal 10 minat')
          return prev
        }
        next.add(interest)
      }
      return next
    })
  }

  const handleSave = async () => {
    if (!user) return
    setSaving(true)
    try {
      const list = Array.from(selected)
      const updated = await apiPatch<ProfileDTO>('/api/profiles/me/interests', {
        interests: list,
      })
      // Persist to local auth store (interests stored as JSON string)
      setUser({
        ...user,
        interests: JSON.stringify(list),
      })
      toast.success(`Tersimpan — ${list.length} minat dipilih`)
      // touch `updated` to acknowledge (no unused var)
      void updated
    } catch (e: any) {
      toast.error(e.message || 'Gagal menyimpan minat')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <SectionHeader
        title="Minat"
        description="Pilih topik yang kamu suka (maks 10) untuk personalisasi feed dan eksplorasi."
      />
      <Card className="p-6">
        <div className="flex flex-wrap gap-2">
          {INTEREST_OPTIONS.map((opt) => {
            const active = selected.has(opt)
            return (
              <button
                key={opt}
                onClick={() => toggle(opt)}
                className={cn(
                  'px-3 py-1.5 rounded-full text-sm font-medium border transition-all',
                  active
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-background border-border hover:bg-muted'
                )}
              >
                {active && <Check className="inline h-3 w-3 mr-1 -mt-0.5" />}
                {opt}
              </button>
            )
          })}
        </div>
        <div className="flex items-center justify-between mt-6">
          <p className="text-xs text-muted-foreground">
            {selected.size}/10 dipilih
          </p>
          <Button onClick={handleSave} disabled={!dirty || saving}>
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Menyimpan...
              </>
            ) : (
              'Simpan minat'
            )}
          </Button>
        </div>
      </Card>
    </div>
  )
}

// ─── Notifikasi (Notifications) ───────────────────
function readLSBoolean(key: string, field: string, fallback: boolean): boolean {
  if (typeof window === 'undefined') return fallback
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    const p = JSON.parse(raw)
    return typeof p[field] === 'boolean' ? p[field] : fallback
  } catch {
    return fallback
  }
}

// localStorage is an external store, so it is read through
// `useSyncExternalStore`: the server snapshot is the fallback (which is what the
// markup was rendered with, so there is no hydration mismatch) and the real
// value is picked up right after hydration — no setState-in-effect cascade.
const LS_LISTENERS = new Set<() => void>()

function persistLS(key: string, value: Record<string, boolean>) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* private mode / quota — the choice simply will not persist */
  }
  LS_LISTENERS.forEach((listener) => listener())
}

function useLSBoolean(key: string, field: string, fallback: boolean): boolean {
  const subscribe = useCallback((onChange: () => void) => {
    LS_LISTENERS.add(onChange)
    window.addEventListener('storage', onChange)
    return () => {
      LS_LISTENERS.delete(onChange)
      window.removeEventListener('storage', onChange)
    }
  }, [])
  const getSnapshot = useCallback(
    () => readLSBoolean(key, field, fallback),
    [key, field, fallback]
  )
  const getServerSnapshot = useCallback(() => fallback, [fallback])
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}

function NotificationsSection() {
  const emailNotif = useLSBoolean('twivter-notif-settings', 'emailNotif', true)
  const pushNotif = useLSBoolean('twivter-notif-settings', 'pushNotif', true)
  const mentionAlerts = useLSBoolean('twivter-notif-settings', 'mentionAlerts', true)

  const onEmail = (v: boolean) => {
    persistLS('twivter-notif-settings', { emailNotif: v, pushNotif, mentionAlerts })
  }
  const onPush = (v: boolean) => {
    persistLS('twivter-notif-settings', { emailNotif, pushNotif: v, mentionAlerts })
  }
  const onMention = (v: boolean) => {
    persistLS('twivter-notif-settings', { emailNotif, pushNotif, mentionAlerts: v })
  }

  return (
    <div>
      <SectionHeader
        title="Notifikasi"
        description="Atur cara kamu menerima pemberitahuan."
      />
      <Card className="p-6 divide-y divide-border">
        <ToggleRow
          icon={Bell}
          title="Email notification"
          desc="Terima email saat ada aktivitas penting"
          checked={emailNotif}
          onChange={onEmail}
        />
        <ToggleRow
          icon={Sparkles}
          title="Push notification"
          desc="Notifikasi langsung di peramban atau perangkat"
          checked={pushNotif}
          onChange={onPush}
        />
        <ToggleRow
          icon={User}
          title="Peringatan mention"
          desc="Beri tahu saat seseorang menyebut @username kamu"
          checked={mentionAlerts}
          onChange={onMention}
        />
      </Card>
      <p className="text-xs text-muted-foreground mt-3 px-1">
        Pengaturan ini disimpan di perangkat ini saja.
      </p>
    </div>
  )
}

// ─── Privasi (Privacy) ────────────────────────────
function PrivacySection() {
  const privateAccount = useLSBoolean('twivter-privacy-settings', 'privateAccount', false)
  const showInSearch = useLSBoolean('twivter-privacy-settings', 'showInSearch', true)

  const onPrivate = (v: boolean) => {
    persistLS('twivter-privacy-settings', { privateAccount: v, showInSearch })
  }
  const onSearch = (v: boolean) => {
    persistLS('twivter-privacy-settings', { privateAccount, showInSearch: v })
  }

  return (
    <div>
      <SectionHeader
        title="Privasi"
        description="Kontrol siapa yang bisa melihat akun dan konten kamu."
      />
      <Card className="p-6 divide-y divide-border">
        <ToggleRow
          icon={Lock}
          title="Akun privat"
          desc="Hanya pengikut yang sudah disetujui yang bisa melihat post kamu"
          checked={privateAccount}
          onChange={onPrivate}
        />
        <ToggleRow
          icon={User}
          title="Tampil di pencarian"
          desc="Akun kamu bisa ditemukan oleh orang lain melalui pencarian"
          checked={showInSearch}
          onChange={onSearch}
        />
      </Card>
      <p className="text-xs text-muted-foreground mt-3 px-1">
        Pengaturan ini disimpan di perangkat ini saja.
      </p>
    </div>
  )
}

// ─── Keamanan (Security) ──────────────────────────
function SecuritySection() {
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showOld, setShowOld] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const canSubmit =
    oldPassword.length >= 6 &&
    newPassword.length >= 6 &&
    newPassword === confirm &&
    newPassword !== oldPassword

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmit) return
    toast.info('Fitur ganti password akan segera hadir')
    setOldPassword('')
    setNewPassword('')
    setConfirm('')
  }

  return (
    <div>
      <SectionHeader
        title="Keamanan"
        description="Lindungi akunmu dengan password yang kuat."
      />
      <Card className="p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="old">Password lama</Label>
            <PasswordInput
              id="old"
              value={oldPassword}
              onChange={setOldPassword}
              show={showOld}
              onToggle={() => setShowOld((s) => !s)}
              placeholder="••••••••"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="new">Password baru</Label>
            <PasswordInput
              id="new"
              value={newPassword}
              onChange={setNewPassword}
              show={showNew}
              onToggle={() => setShowNew((s) => !s)}
              placeholder="••••••••"
            />
            {newPassword && newPassword.length < 6 && (
              <p className="text-xs text-destructive">
                Password minimal 6 karakter
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm">Konfirmasi password baru</Label>
            <PasswordInput
              id="confirm"
              value={confirm}
              onChange={setConfirm}
              show={showConfirm}
              onToggle={() => setShowConfirm((s) => !s)}
              placeholder="••••••••"
            />
            {confirm && confirm !== newPassword && (
              <p className="text-xs text-destructive">
                Konfirmasi tidak cocok
              </p>
            )}
          </div>
          <div className="flex justify-end pt-2">
            <Button type="submit" disabled={!canSubmit}>
              Ubah password
            </Button>
          </div>
        </form>
      </Card>
    </div>
  )
}

// ─── Tentang (About) ──────────────────────────────
function AboutSection() {
  return (
    <div>
      <SectionHeader
        title="Tentang Twivter"
        description="Platform social media modern — Connect, Share, Discover."
      />
      <Card className="p-6 space-y-6">
        <div className="flex items-start gap-4">
          <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shrink-0">
            <Sparkles className="h-6 w-6 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-lg">Twivter</h3>
              <Badge variant="secondary" className="text-xs">
                v1.0.0
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Dibangun dengan Next.js 16 di atas Cloudflare Workers, memakai D1
              untuk basis data, R2 untuk penyimpanan media, dan Durable Objects
              untuk realtime chat.
            </p>
          </div>
        </div>

        <Separator />

        <div>
          <h4 className="font-semibold mb-3 text-sm">Tautan</h4>
          <div className="grid grid-cols-2 gap-3">
            <AboutLink
              icon={Github}
              label="GitHub"
              href="https://github.com"
            />
            <AboutLink
              icon={Twitter}
              label="Twitter / X"
              href="https://twitter.com"
            />
            <AboutLink
              icon={Globe}
              label="Website"
              href="https://twivter.com"
            />
            <AboutLink
              icon={Info}
              label="Bantuan"
              href="https://twivter.com/help"
            />
          </div>
        </div>

        <Separator />

        <div>
          <h4 className="font-semibold mb-2 text-sm">Kredit</h4>
          <p className="text-sm text-muted-foreground">
            Dibuat dengan ❤️ oleh tim Twivter. Menggunakan shadcn/ui, Tailwind
            CSS, Recharts, Lucide icons, dan Framer Motion.
          </p>
        </div>

        <Separator />

        <p className="text-xs text-muted-foreground">
          © {new Date().getFullYear()} Twivter. Semua hak dilindungi.
        </p>
      </Card>
    </div>
  )
}

function AboutLink({
  icon: Icon,
  label,
  href,
}: {
  icon: typeof Github
  label: string
  href: string
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-3 rounded-lg border border-border p-3 hover:bg-muted transition-colors"
    >
      <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
      <span className="text-sm font-medium flex-1">{label}</span>
      <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
    </a>
  )
}

// ─── Shared bits ──────────────────────────────────
function ToggleRow({
  icon: Icon,
  title,
  desc,
  checked,
  onChange,
}: {
  icon: typeof Bell
  title: string
  desc: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-center gap-4 py-4 first:pt-0 last:pb-0">
      <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm">{title}</p>
        <p className="text-xs text-muted-foreground">{desc}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  )
}

function PasswordInput({
  id,
  value,
  onChange,
  show,
  onToggle,
  placeholder,
}: {
  id: string
  value: string
  onChange: (v: string) => void
  show: boolean
  onToggle: () => void
  placeholder?: string
}) {
  return (
    <div className="relative">
      <Input
        id={id}
        type={show ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="pr-10"
      />
      <button
        type="button"
        onClick={onToggle}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-xs font-medium"
      >
        {show ? 'Sembunyikan' : 'Lihat'}
      </button>
    </div>
  )
}

// ─── Logout ───────────────────────────────────────
function LogoutButton() {
  const navigate = useViewStore((s) => s.navigate)
  const [loading, setLoading] = useState(false)

  const handleLogout = async () => {
    setLoading(true)
    try {
      await apiPost('/api/auth/logout')
      // Hard reload so the bootstrap in providers re-evaluates auth state.
      if (typeof window !== 'undefined') {
        window.location.href = '/'
      } else {
        navigate('landing')
      }
    } catch (e: any) {
      toast.error(e.message || 'Gagal logout')
      setLoading(false)
    }
  }

  return (
    <Button
      variant="outline"
      onClick={handleLogout}
      disabled={loading}
      className="w-full text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/30"
    >
      {loading ? (
        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
      ) : (
        <LogOut className="h-4 w-4 mr-2" />
      )}
      Keluar dari Twivter
    </Button>
  )
}
