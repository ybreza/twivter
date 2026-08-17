'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import {
  Loader2,
  Check,
  X,
  AtSign,
  User,
  Camera,
  Globe,
  MapPin,
  Sparkles,
  ArrowLeft,
  ArrowRight,
  Upload,
  Heart,
  UserCheck,
  CheckCircle2,
} from 'lucide-react'
import { TwivterLogo, TwivterWordmark } from '@/components/twivter-logo'
import { UserAvatar } from '@/components/user-avatar'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { useAuthStore, useViewStore } from '@/stores/app-store'
import { apiPost } from '@/lib/hooks'
import type { CurrentUser } from '@/stores/app-store'
import { INTEREST_OPTIONS } from '@/lib/types'
import { useApi } from '@/lib/hooks'
import { formatCount } from '@/lib/api'
import { cn, validateImageFile } from '@/lib/utils'

// Suggestion type returned by /api/explore/suggestions
interface SuggestionUser {
  id: string
  username: string
  displayName: string
  avatarUrl: string | null
  verified: boolean
  bio: string | null
  followersCount: number
  isFollowing: boolean
}

const TOTAL_STEPS = 6

const STEP_META = [
  { title: 'Username', subtitle: 'Pilih username unik untuk akun kamu', icon: AtSign },
  { title: 'Nama tampilan', subtitle: 'Bagaimana kami harus memanggilmu?', icon: User },
  { title: 'Foto profil', subtitle: 'Tambahkan foto agar mudah dikenali', icon: Camera },
  { title: 'Bio & lokasi', subtitle: 'Ceritakan sedikit tentang dirimu', icon: Globe },
  { title: 'Minat', subtitle: 'Pilih topik yang kamu suka', icon: Sparkles },
  { title: 'Ikuti akun', subtitle: 'Follow beberapa orang untuk mengisi feed-mu', icon: Heart },
]

export function OnboardingView() {
  const user = useAuthStore((s) => s.user)
  const setUser = useAuthStore((s) => s.setUser)
  const navigate = useViewStore((s) => s.navigate)

  // Wizard state (prefilled from current user)
  const [step, setStep] = useState(0)
  const [username, setUsername] = useState(user?.username ?? '')
  const [displayName, setDisplayName] = useState(user?.displayName ?? '')
  const [bio, setBio] = useState(user?.bio ?? '')
  const [website, setWebsite] = useState(user?.website ?? '')
  const [location, setLocation] = useState(user?.location ?? '')
  const [avatarUrl, setAvatarUrl] = useState<string | null>(user?.avatarUrl ?? null)
  const [interests, setInterests] = useState<string[]>(() => {
    if (user?.interests) {
      try {
        const parsed = JSON.parse(user.interests)
        if (Array.isArray(parsed)) return parsed
      } catch {
        // ignore
      }
    }
    return []
  })
  const [followedIds, setFollowedIds] = useState<Set<string>>(new Set())

  const [submitting, setSubmitting] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [direction, setDirection] = useState<1 | -1>(1)

  // ── Username live check (debounced) ────────────
  const [usernameState, setUsernameState] = useState<
    | { status: 'idle' }
    | { status: 'checking' }
    | { status: 'available' }
    | { status: 'taken' }
    | { status: 'invalid'; message: string }
  >({ status: 'idle' })
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastCheckedRef = useRef<string>('')

  const checkUsername = useCallback(
    (value: string) => {
      if (debounceRef.current) clearTimeout(debounceRef.current)

      if (!value) {
        setUsernameState({ status: 'idle' })
        return
      }
      if (!/^[a-zA-Z0-9_]+$/.test(value)) {
        setUsernameState({ status: 'invalid', message: 'Hanya huruf, angka, dan underscore' })
        return
      }
      if (value.length < 3) {
        setUsernameState({ status: 'invalid', message: 'Minimal 3 karakter' })
        return
      }
      if (value.length > 20) {
        setUsernameState({ status: 'invalid', message: 'Maksimal 20 karakter' })
        return
      }
      if (lastCheckedRef.current === value) return

      setUsernameState({ status: 'checking' })
      debounceRef.current = setTimeout(async () => {
        try {
          const res = await fetch(
            `/api/auth/check-username?username=${encodeURIComponent(value)}`,
            { cache: 'no-store' }
          )
          const data = await res.json()
          lastCheckedRef.current = value
          if (data.available) setUsernameState({ status: 'available' })
          else if (data.reason === 'taken') setUsernameState({ status: 'taken' })
          else if (data.reason === 'invalid')
            setUsernameState({ status: 'invalid', message: data.message || 'Tidak valid' })
          else setUsernameState({ status: 'idle' })
        } catch {
          setUsernameState({ status: 'idle' })
        }
      }, 450)
    },
    []
  )

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  function onUsernameChange(value: string) {
    const sanitized = value.replace(/[^a-zA-Z0-9_]/g, '')
    setUsername(sanitized)
    lastCheckedRef.current = ''
    checkUsername(sanitized)
  }

  // ── Avatar upload ──────────────────────────────
  const avatarInputRef = useRef<HTMLInputElement>(null)

  async function handleAvatarChange(file: File | undefined) {
    if (!file) return
    const err = validateImageFile(file, 5)
    if (err) {
      toast.error(err)
      return
    }
    setUploadingAvatar(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('bucket', 'avatars')
      const res = await fetch('/api/upload', { method: 'POST', body: formData })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Upload gagal')
      setAvatarUrl(data.url)
      toast.success('Foto profil diupload!')
    } catch (e: any) {
      toast.error(e?.message || 'Gagal upload foto')
    } finally {
      setUploadingAvatar(false)
    }
  }

  // ── Suggestions ────────────────────────────────
  const { data: suggestionsData, loading: loadingSugs } = useApi<{ users: SuggestionUser[] }>(
    step === 5 ? '/api/explore/suggestions' : null
  )
  const suggestions = useMemo(
    () => suggestionsData?.users ?? [],
    [suggestionsData]
  )

  // Initialize followedIds with users already followed (only once when suggestions load)
  const followedInitializedRef = useRef(false)
  useEffect(() => {
    if (suggestions.length > 0 && !followedInitializedRef.current) {
      followedInitializedRef.current = true
      const initial = new Set<string>()
      suggestions.forEach((s) => {
        if (s.isFollowing) initial.add(s.id)
      })
      if (initial.size > 0) setFollowedIds(initial)
    }
  }, [suggestions])

  function toggleFollow(id: string) {
    setFollowedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleInterest(name: string) {
    setInterests((prev) => {
      if (prev.includes(name)) return prev.filter((i) => i !== name)
      if (prev.length >= 10) {
        toast.error('Maksimal 10 minat')
        return prev
      }
      return [...prev, name]
    })
  }

  // ── Step validation ────────────────────────────
  function isStepValid(s: number): boolean {
    switch (s) {
      case 0:
        return (
          usernameState.status === 'available' ||
          (username === user?.username && usernameState.status !== 'invalid' && usernameState.status !== 'taken')
        )
      case 1:
        return displayName.trim().length > 0 && displayName.trim().length <= 50
      case 2:
        return true // avatar optional
      case 3:
        return bio.length <= 160 && website.length <= 200 && location.length <= 100
      case 4:
        return interests.length > 0
      case 5:
        return true // follows optional
      default:
        return true
    }
  }

  function goNext() {
    if (step === 0 && username !== user?.username) {
      // Trigger check if user hasn't typed yet
      if (usernameState.status === 'idle') {
        checkUsername(username)
        return
      }
      if (usernameState.status === 'checking') return
      if (usernameState.status === 'taken' || usernameState.status === 'invalid') return
    }
    if (!isStepValid(step)) return
    if (step >= TOTAL_STEPS - 1) return
    setDirection(1)
    setStep((s) => s + 1)
  }

  function goBack() {
    if (step === 0) {
      // Allow logout via toast confirm — but really, onboarding is mandatory.
      toast.info('Selesaikan onboarding dulu ya, biar akun kamu siap dipakai 🙏')
      return
    }
    setDirection(-1)
    setStep((s) => s - 1)
  }

  // ── Final submit ───────────────────────────────
  async function finish() {
    // Final validation
    if (!username || !displayName.trim()) {
      toast.error('Username dan nama tampilan wajib diisi')
      return
    }
    if (interests.length === 0) {
      toast.error('Pilih minimal 1 minat')
      return
    }

    setSubmitting(true)
    try {
      const res = await apiPost<{ user: CurrentUser }>('/api/onboarding', {
        username: username.trim(),
        displayName: displayName.trim(),
        bio: bio.trim() || undefined,
        website: website.trim() || undefined,
        location: location.trim() || undefined,
        avatarUrl: avatarUrl ?? undefined,
        interests,
        followUserIds: Array.from(followedIds),
      })
      setUser(res.user)
      toast.success(`Selamat datang di Twivter, ${res.user.displayName.split(' ')[0]}! 🎉`)
      navigate('home')
    } catch (e: any) {
      toast.error(e?.message || 'Gagal menyelesaikan onboarding')
    } finally {
      setSubmitting(false)
    }
  }

  const currentMeta = STEP_META[step]
  const progress = ((step + 1) / TOTAL_STEPS) * 100

  return (
    <div className="min-h-screen flex flex-col bg-background relative overflow-hidden">
      {/* Background */}
      <div className="fixed inset-0 -z-10">
        <div className="absolute -top-32 -left-32 h-96 w-96 rounded-full bg-primary/15 blur-3xl" />
        <div className="absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-purple-500/15 blur-3xl" />
        <div
          className="absolute inset-0 opacity-[0.04] dark:opacity-[0.07]"
          style={{
            backgroundImage:
              'linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        />
      </div>

      {/* Top progress header */}
      <header className="px-4 sm:px-6 pt-6 pb-4">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <TwivterLogo size={28} />
              <TwivterWordmark className="text-lg" />
            </div>
            <span className="text-xs text-muted-foreground">
              Langkah {step + 1} dari {TOTAL_STEPS}
            </span>
          </div>
          {/* Progress bar */}
          <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-blue-500 to-purple-500"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.4 }}
            />
          </div>
          {/* Step dots */}
          <div className="flex items-center justify-between mt-3 px-1">
            {STEP_META.map((s, i) => {
              const Icon = s.icon
              const done = i < step
              const active = i === step
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => {
                    if (i < step) {
                      setDirection(-1)
                      setStep(i)
                    }
                  }}
                  disabled={i > step}
                  className={cn(
                    'flex flex-col items-center gap-1 transition-opacity',
                    i > step ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'
                  )}
                  aria-label={`Langkah ${i + 1}: ${s.title}`}
                >
                  <div
                    className={cn(
                      'h-7 w-7 rounded-full flex items-center justify-center text-xs font-semibold border-2 transition-all',
                      done && 'bg-primary border-primary text-primary-foreground',
                      active && 'bg-background border-primary text-primary',
                      !done && !active && 'bg-background border-border text-muted-foreground'
                    )}
                  >
                    {done ? <Check className="h-3.5 w-3.5" /> : <Icon className="h-3.5 w-3.5" />}
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 flex items-start sm:items-center justify-center px-4 sm:px-6 pb-32 sm:pb-12">
        <div className="w-full max-w-2xl">
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={step}
              custom={direction}
              initial={{ opacity: 0, x: direction * 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: direction * -40 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
            >
              <Card className="shadow-xl border-border/60 bg-card/95 backdrop-blur-xl">
                <CardContent className="px-6 sm:px-8 pt-2">
                  {/* Step header */}
                  <div className="flex flex-col gap-1 mb-6 text-center">
                    <div className="flex justify-center mb-2">
                      <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center shadow-lg">
                        <currentMeta.icon className="h-6 w-6 text-white" />
                      </div>
                    </div>
                    <h2 className="text-2xl font-bold">{currentMeta.title}</h2>
                    <p className="text-sm text-muted-foreground">{currentMeta.subtitle}</p>
                  </div>

                  {/* Step 0: Username */}
                  {step === 0 && (
                    <div className="flex flex-col gap-4">
                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor="onb-username">Username</Label>
                        <div className="relative">
                          <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                          <Input
                            id="onb-username"
                            value={username}
                            onChange={(e) => onUsernameChange(e.target.value)}
                            className="pl-9 pr-9 text-base h-11"
                            maxLength={20}
                            autoFocus
                          />
                          <div className="absolute right-3 top-1/2 -translate-y-1/2">
                            {usernameState.status === 'checking' && (
                              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                            )}
                            {usernameState.status === 'available' && (
                              <Check className="h-4 w-4 text-emerald-500" />
                            )}
                            {(usernameState.status === 'taken' ||
                              usernameState.status === 'invalid') && (
                              <X className="h-4 w-4 text-destructive" />
                            )}
                          </div>
                        </div>
                        {/* Status */}
                        {usernameState.status === 'idle' && (
                          <p className="text-xs text-muted-foreground">
                            3–20 karakter, huruf/angka/underscore
                          </p>
                        )}
                        {usernameState.status === 'available' && (
                          <p className="text-xs text-emerald-600 dark:text-emerald-400">
                            Username tersedia! 🎉
                          </p>
                        )}
                        {usernameState.status === 'taken' && (
                          <p className="text-xs text-destructive">Username sudah dipakai</p>
                        )}
                        {usernameState.status === 'invalid' && (
                          <p className="text-xs text-destructive">{usernameState.message}</p>
                        )}
                      </div>
                      {/* Live preview */}
                      <div className="rounded-xl border border-border bg-muted/40 p-4 flex items-center gap-3">
                        <UserAvatar
                          username={username || 'preview'}
                          displayName={displayName || 'Kamu'}
                          avatarUrl={avatarUrl}
                          size="lg"
                          showVerified={false}
                        />
                        <div className="min-w-0">
                          <p className="font-semibold truncate">
                            {displayName || 'Nama Kamu'}
                          </p>
                          <p className="text-sm text-muted-foreground truncate">
                            @{username || 'username'}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Step 1: Display name */}
                  {step === 1 && (
                    <div className="flex flex-col gap-4">
                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor="onb-displayName">Nama tampilan</Label>
                        <div className="relative">
                          <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                          <Input
                            id="onb-displayName"
                            value={displayName}
                            onChange={(e) => setDisplayName(e.target.value)}
                            className="pl-9 text-base h-11"
                            maxLength={50}
                            autoFocus
                            placeholder="Contoh: Budi Santoso"
                          />
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {displayName.length}/50 karakter
                        </p>
                      </div>
                      <div className="rounded-xl border border-border bg-muted/40 p-4 flex items-center gap-3">
                        <UserAvatar
                          username={username || 'preview'}
                          displayName={displayName || 'Kamu'}
                          avatarUrl={avatarUrl}
                          size="lg"
                          showVerified={false}
                        />
                        <div className="min-w-0">
                          <p className="font-semibold truncate">
                            {displayName || 'Nama Kamu'}
                          </p>
                          <p className="text-sm text-muted-foreground truncate">
                            @{username || 'username'}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Step 2: Avatar upload */}
                  {step === 2 && (
                    <div className="flex flex-col items-center gap-6">
                      <div className="relative">
                        <UserAvatar
                          username={username || 'preview'}
                          displayName={displayName || 'Kamu'}
                          avatarUrl={avatarUrl}
                          size="2xl"
                          showVerified={false}
                        />
                        {uploadingAvatar && (
                          <div className="absolute inset-0 rounded-full bg-background/70 flex items-center justify-center">
                            <Loader2 className="h-6 w-6 animate-spin" />
                          </div>
                        )}
                      </div>

                      <input
                        ref={avatarInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif"
                        className="hidden"
                        onChange={(e) => handleAvatarChange(e.target.files?.[0])}
                      />

                      <div className="flex flex-col items-center gap-3">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => avatarInputRef.current?.click()}
                          disabled={uploadingAvatar}
                          className="rounded-full"
                        >
                          {uploadingAvatar ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Mengupload...
                            </>
                          ) : avatarUrl ? (
                            <>
                              <Upload className="h-4 w-4" />
                              Ganti foto
                            </>
                          ) : (
                            <>
                              <Camera className="h-4 w-4" />
                              Upload foto
                            </>
                          )}
                        </Button>
                        {avatarUrl && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setAvatarUrl(null)}
                            className="text-muted-foreground"
                          >
                            Hapus foto
                          </Button>
                        )}
                      </div>

                      <p className="text-xs text-muted-foreground text-center max-w-xs">
                        Format: JPG, PNG, WEBP, GIF. Maks 5MB. Direkomendasikan foto persegi 400×400.
                      </p>
                    </div>
                  )}

                  {/* Step 3: Bio + website + location */}
                  {step === 3 && (
                    <div className="flex flex-col gap-4">
                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor="onb-bio">Bio</Label>
                        <Textarea
                          id="onb-bio"
                          value={bio}
                          onChange={(e) => setBio(e.target.value)}
                          maxLength={160}
                          rows={3}
                          autoFocus
                          placeholder="Ceritakan sedikit tentang dirimu..."
                          className="resize-none"
                        />
                        <p className="text-xs text-muted-foreground">{bio.length}/160 karakter</p>
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor="onb-website">Website</Label>
                        <div className="relative">
                          <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                          <Input
                            id="onb-website"
                            value={website}
                            onChange={(e) => setWebsite(e.target.value)}
                            className="pl-9"
                            placeholder="https://kamunya.com"
                            maxLength={200}
                          />
                        </div>
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor="onb-location">Lokasi</Label>
                        <div className="relative">
                          <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                          <Input
                            id="onb-location"
                            value={location}
                            onChange={(e) => setLocation(e.target.value)}
                            className="pl-9"
                            placeholder="Jakarta, Indonesia"
                            maxLength={100}
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Step 4: Interests */}
                  {step === 4 && (
                    <div className="flex flex-col gap-4">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Pilih minimal 1 minat</span>
                        <Badge variant="secondary">{interests.length} / 10</Badge>
                      </div>
                      <div className="flex flex-wrap gap-2 justify-center">
                        {INTEREST_OPTIONS.map((opt) => {
                          const active = interests.includes(opt)
                          return (
                            <button
                              key={opt}
                              type="button"
                              onClick={() => toggleInterest(opt)}
                              className={cn(
                                'px-4 py-2 rounded-full border text-sm font-medium transition-all',
                                active
                                  ? 'bg-primary border-primary text-primary-foreground shadow-md scale-105'
                                  : 'bg-background border-border hover:border-primary/40 hover:bg-accent/50'
                              )}
                            >
                              {active && <Check className="h-3.5 w-3.5 inline mr-1" />}
                              {opt}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* Step 5: Follow suggestions */}
                  {step === 5 && (
                    <div className="flex flex-col gap-4">
                      <p className="text-sm text-muted-foreground text-center">
                        Mengikuti {followedIds.size} akun. Kamu bisa skip jika mau.
                      </p>
                      {loadingSugs ? (
                        <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
                          <Loader2 className="h-6 w-6 animate-spin" />
                          <span className="text-sm">Memuat saran akun...</span>
                        </div>
                      ) : suggestions.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground text-sm">
                          Belum ada saran akun tersedia.
                        </div>
                      ) : (
                        <div className="flex flex-col gap-2 max-h-80 overflow-y-auto scrollbar-thin -mx-2 px-2">
                          {suggestions.map((s) => {
                            const followed = followedIds.has(s.id)
                            return (
                              <div
                                key={s.id}
                                className="flex items-center gap-3 p-2 rounded-xl hover:bg-muted/50 transition-colors"
                              >
                                <UserAvatar
                                  username={s.username}
                                  displayName={s.displayName}
                                  avatarUrl={s.avatarUrl}
                                  verified={s.verified}
                                  size="md"
                                />
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-1">
                                    <span className="font-semibold text-sm truncate">
                                      {s.displayName}
                                    </span>
                                    {s.verified && (
                                      <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0" />
                                    )}
                                  </div>
                                  <p className="text-xs text-muted-foreground truncate">
                                    @{s.username} · {formatCount(s.followersCount)} pengikut
                                  </p>
                                  {s.bio && (
                                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                                      {s.bio}
                                    </p>
                                  )}
                                </div>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant={followed ? 'secondary' : 'default'}
                                  onClick={() => toggleFollow(s.id)}
                                  className="rounded-full shrink-0 min-w-[88px]"
                                >
                                  {followed ? (
                                    <>
                                      <UserCheck className="h-3.5 w-3.5" />
                                      Mengikuti
                                    </>
                                  ) : (
                                    <>
                                      <Heart className="h-3.5 w-3.5" />
                                      Ikuti
                                    </>
                                  )}
                                </Button>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      {/* Sticky action bar */}
      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
          <Button
            variant="ghost"
            onClick={goBack}
            disabled={submitting}
            className="rounded-full"
          >
            <ArrowLeft className="h-4 w-4" />
            {step === 0 ? 'Nanti saja' : 'Kembali'}
          </Button>

          {step < TOTAL_STEPS - 1 ? (
            <Button
              onClick={goNext}
              disabled={
                submitting ||
                uploadingAvatar ||
                (step === 0 && (usernameState.status === 'checking' || usernameState.status === 'taken' || usernameState.status === 'invalid'))
              }
              className="rounded-full min-w-[120px] bg-gradient-to-r from-blue-500 to-purple-500 hover:opacity-90"
            >
              Lanjut
              <ArrowRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              onClick={finish}
              disabled={submitting}
              className="rounded-full min-w-[140px] bg-gradient-to-r from-blue-500 to-purple-500 hover:opacity-90 shadow-lg"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Menyimpan...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Selesai
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
