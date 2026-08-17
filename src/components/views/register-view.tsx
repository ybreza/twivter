'use client'

import { useState, useEffect, useCallback, FormEvent, useRef } from 'react'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import {
  Eye,
  EyeOff,
  Loader2,
  ArrowLeft,
  Mail,
  Lock,
  User,
  AtSign,
  Check,
  X,
  Sparkles,
} from 'lucide-react'
import { TwivterLogo, TwivterWordmark } from '@/components/twivter-logo'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuthStore, useViewStore } from '@/stores/app-store'
import { apiPost } from '@/lib/hooks'
import type { CurrentUser } from '@/stores/app-store'

type UsernameState =
  | { status: 'idle' }
  | { status: 'checking' }
  | { status: 'available' }
  | { status: 'taken' }
  | { status: 'invalid'; message: string }

export function RegisterView() {
  const navigate = useViewStore((s) => s.navigate)
  const setUser = useAuthStore((s) => s.setUser)

  const [displayName, setDisplayName] = useState('')
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)

  const [usernameState, setUsernameState] = useState<UsernameState>({ status: 'idle' })
  const [emailError, setEmailError] = useState<string | null>(null)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [displayNameError, setDisplayNameError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)

  // Live username availability check (debounced)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastCheckedRef = useRef<string>('')

  const checkUsername = useCallback((value: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current)

    // Client-side validation first
    if (!value) {
      setUsernameState({ status: 'idle' })
      return
    }
    if (!/^[a-zA-Z0-9_]+$/.test(value)) {
      setUsernameState({
        status: 'invalid',
        message: 'Hanya huruf, angka, dan underscore',
      })
      return
    }
    if (value.length < 3) {
      setUsernameState({
        status: 'invalid',
        message: 'Minimal 3 karakter',
      })
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
        if (data.available) {
          setUsernameState({ status: 'available' })
        } else if (data.reason === 'taken') {
          setUsernameState({ status: 'taken' })
        } else if (data.reason === 'invalid') {
          setUsernameState({ status: 'invalid', message: data.message || 'Username tidak valid' })
        } else {
          setUsernameState({ status: 'idle' })
        }
      } catch {
        // Network failure — don't block submit
        setUsernameState({ status: 'idle' })
      }
    }, 450)
  }, [])

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  function onUsernameChange(value: string) {
    // Strip invalid characters inline (don't allow spaces etc.)
    const sanitized = value.replace(/[^a-zA-Z0-9_]/g, '')
    setUsername(sanitized)
    lastCheckedRef.current = ''
    checkUsername(sanitized)
  }

  function onEmailChange(value: string) {
    setEmail(value)
    if (emailError) setEmailError(null)
  }

  function onPasswordChange(value: string) {
    setPassword(value)
    if (passwordError) {
      if (value.length >= 6) setPasswordError(null)
    }
  }

  function onDisplayNameChange(value: string) {
    setDisplayName(value)
    if (displayNameError) setDisplayNameError(null)
  }

  function validate(): boolean {
    let valid = true

    if (!displayName.trim()) {
      setDisplayNameError('Nama tampilan wajib diisi')
      valid = false
    } else if (displayName.trim().length > 50) {
      setDisplayNameError('Maksimal 50 karakter')
      valid = false
    } else {
      setDisplayNameError(null)
    }

    if (!username) {
      setUsernameState({ status: 'invalid', message: 'Username wajib diisi' })
      valid = false
    } else if (usernameState.status === 'taken') {
      valid = false
    } else if (usernameState.status === 'invalid') {
      valid = false
    } else if (usernameState.status === 'idle' || usernameState.status === 'checking') {
      // Force a check before submit
      valid = false
      if (usernameState.status === 'idle') {
        checkUsername(username)
      }
    }

    if (!email) {
      setEmailError('Email wajib diisi')
      valid = false
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setEmailError('Format email tidak valid')
      valid = false
    } else {
      setEmailError(null)
    }

    if (!password) {
      setPasswordError('Password wajib diisi')
      valid = false
    } else if (password.length < 6) {
      setPasswordError('Minimal 6 karakter')
      valid = false
    } else {
      setPasswordError(null)
    }

    return valid
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setFormError(null)

    if (!validate()) {
      toast.error('Periksa kembali isian kamu')
      return
    }

    setLoading(true)
    try {
      const res = await apiPost<{ user: CurrentUser }>('/api/auth/register', {
        email: email.trim().toLowerCase(),
        password,
        username: username.trim(),
        displayName: displayName.trim(),
      })
      setUser(res.user)
      toast.success('Akun berhasil dibuat! 🎉')
      navigate('onboarding')
    } catch (err: any) {
      const msg = err?.message || 'Gagal mendaftar. Coba lagi.'
      setFormError(msg)
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  // Password strength indicator
  const passwordStrength = (() => {
    if (!password) return 0
    let score = 0
    if (password.length >= 6) score++
    if (password.length >= 10) score++
    if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++
    if (/\d/.test(password)) score++
    if (/[^a-zA-Z0-9]/.test(password)) score++
    return Math.min(score, 4)
  })()

  const strengthLabels = ['Terlalu pendek', 'Lemah', 'Cukup', 'Bagus', 'Kuat']
  const strengthColors = [
    'bg-muted',
    'bg-red-500',
    'bg-amber-500',
    'bg-blue-500',
    'bg-emerald-500',
  ]

  return (
    <div className="min-h-screen flex flex-col bg-background relative overflow-hidden">
      {/* Background */}
      <div className="fixed inset-0 -z-10">
        <div className="absolute -top-32 -right-32 h-96 w-96 rounded-full bg-purple-500/20 blur-3xl" />
        <div className="absolute -bottom-32 -left-32 h-96 w-96 rounded-full bg-primary/20 blur-3xl" />
        <div
          className="absolute inset-0 opacity-[0.04] dark:opacity-[0.07]"
          style={{
            backgroundImage:
              'linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        />
      </div>

      {/* Top bar */}
      <header className="px-4 sm:px-6 py-4">
        <button
          onClick={() => navigate('landing')}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Kembali ke beranda
        </button>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 sm:px-6 pb-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md"
        >
          {/* Header */}
          <div className="flex flex-col items-center text-center mb-6">
            <TwivterLogo size={64} className="mb-3 drop-shadow-xl" />
            <h1 className="text-3xl font-bold mb-1">
              Gabung <TwivterWordmark className="text-3xl" />
            </h1>
            <p className="text-muted-foreground text-sm">
              Buat akun gratis, cuma butuh beberapa detik.
            </p>
          </div>

          <Card className="shadow-xl border-border/60 backdrop-blur-xl bg-card/95">
            <CardContent className="px-6">
              <form onSubmit={handleSubmit} className="flex flex-col gap-4 pt-2">
                {/* Display name */}
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="displayName">Nama tampilan</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                    <Input
                      id="displayName"
                      type="text"
                      autoComplete="name"
                      placeholder="Contoh: Budi Santoso"
                      value={displayName}
                      onChange={(e) => onDisplayNameChange(e.target.value)}
                      disabled={loading}
                      className="pl-9"
                      maxLength={50}
                      aria-invalid={!!displayNameError}
                    />
                  </div>
                  {displayNameError ? (
                    <p className="text-xs text-destructive">{displayNameError}</p>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      {displayName.length}/50 karakter
                    </p>
                  )}
                </div>

                {/* Username */}
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="username">Username</Label>
                  <div className="relative">
                    <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                    <Input
                      id="username"
                      type="text"
                      autoComplete="username"
                      placeholder="budisan"
                      value={username}
                      onChange={(e) => onUsernameChange(e.target.value)}
                      disabled={loading}
                      className="pl-9 pr-9"
                      maxLength={20}
                      aria-invalid={
                        usernameState.status === 'taken' || usernameState.status === 'invalid'
                      }
                    />
                    {/* Status icon */}
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
                  {/* Status message */}
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
                    <p className="text-xs text-destructive">
                      Username sudah dipakai, coba yang lain
                    </p>
                  )}
                  {usernameState.status === 'invalid' && (
                    <p className="text-xs text-destructive">{usernameState.message}</p>
                  )}
                </div>

                {/* Email */}
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                    <Input
                      id="email"
                      type="email"
                      autoComplete="email"
                      placeholder="kamu@email.com"
                      value={email}
                      onChange={(e) => onEmailChange(e.target.value)}
                      disabled={loading}
                      className="pl-9"
                      aria-invalid={!!emailError}
                    />
                  </div>
                  {emailError && <p className="text-xs text-destructive">{emailError}</p>}
                </div>

                {/* Password */}
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      placeholder="Minimal 6 karakter"
                      value={password}
                      onChange={(e) => onPasswordChange(e.target.value)}
                      disabled={loading}
                      className="pl-9 pr-9"
                      aria-invalid={!!passwordError}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((s) => !s)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {/* Strength meter */}
                  {password && !passwordError && (
                    <div className="flex items-center gap-2">
                      <div className="flex gap-1 flex-1">
                        {[1, 2, 3, 4].map((i) => (
                          <div
                            key={i}
                            className={`h-1.5 flex-1 rounded-full transition-colors ${
                              i <= passwordStrength ? strengthColors[passwordStrength] : 'bg-muted'
                            }`}
                          />
                        ))}
                      </div>
                      <span className="text-xs text-muted-foreground w-16 text-right">
                        {strengthLabels[passwordStrength]}
                      </span>
                    </div>
                  )}
                  {passwordError && <p className="text-xs text-destructive">{passwordError}</p>}
                </div>

                {/* Form-level error */}
                {formError && (
                  <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">
                    {formError}
                  </div>
                )}

                {/* Submit */}
                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full h-11 rounded-full font-semibold bg-gradient-to-r from-blue-500 to-purple-500 hover:opacity-90 shadow-lg shadow-primary/20"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Membuat akun...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" />
                      Buat akun saya
                    </>
                  )}
                </Button>

                <p className="text-xs text-muted-foreground text-center">
                  Dengan mendaftar, kamu menyetujui Syarat & Ketentuan Twivter.
                </p>
              </form>
            </CardContent>
          </Card>

          {/* Footer link */}
          <p className="text-center text-sm text-muted-foreground mt-6">
            Sudah punya akun?{' '}
            <button
              onClick={() => navigate('login')}
              className="text-primary font-semibold hover:underline"
            >
              Masuk
            </button>
          </p>
        </motion.div>
      </main>
    </div>
  )
}
