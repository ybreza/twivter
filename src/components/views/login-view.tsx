'use client'

import { useState, FormEvent } from 'react'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { Eye, EyeOff, Loader2, ArrowLeft, Mail, Lock } from 'lucide-react'
import { TwivterLogo, TwivterWordmark } from '@/components/twivter-logo'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuthStore, useViewStore } from '@/stores/app-store'
import { apiPost } from '@/lib/hooks'
import type { CurrentUser } from '@/stores/app-store'

export function LoginView() {
  const navigate = useViewStore((s) => s.navigate)
  const setUser = useAuthStore((s) => s.setUser)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)

    if (!email || !password) {
      setError('Email dan password wajib diisi')
      return
    }

    setLoading(true)
    try {
      const res = await apiPost<{ user: CurrentUser }>('/api/auth/login', {
        email: email.trim(),
        password,
      })
      setUser(res.user)
      toast.success(`Halo lagi, ${res.user.displayName.split(' ')[0]}! 👋`)
      // Route based on onboarding status
      if (res.user.onboarded) {
        navigate('home')
      } else {
        navigate('onboarding')
      }
    } catch (err: any) {
      const msg = err?.message || 'Gagal masuk. Coba lagi.'
      setError(msg)
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-background relative overflow-hidden">
      {/* Animated gradient background */}
      <div className="fixed inset-0 -z-10">
        <div className="absolute -top-32 -left-32 h-96 w-96 rounded-full bg-primary/20 blur-3xl" />
        <div className="absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-purple-500/20 blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-72 w-72 rounded-full bg-cyan-400/10 blur-3xl" />
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
          {/* Logo header */}
          <div className="flex flex-col items-center text-center mb-8">
            <TwivterLogo size={64} className="mb-3 drop-shadow-xl" />
            <h1 className="text-3xl font-bold mb-1">
              Masuk ke <TwivterWordmark className="text-3xl" />
            </h1>
            <p className="text-muted-foreground text-sm">
              Selamat datang kembali! Kami merindukanmu.
            </p>
          </div>

          <Card className="shadow-xl border-border/60 backdrop-blur-xl bg-card/95">
            <CardContent className="px-6">
              <form onSubmit={handleSubmit} className="flex flex-col gap-4 pt-2">
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
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={loading}
                      className="pl-9"
                      aria-invalid={!!error}
                    />
                  </div>
                </div>

                {/* Password */}
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">Password</Label>
                    <button
                      type="button"
                      className="text-xs text-primary hover:underline"
                      onClick={() => toast.info('Fitur lupa password belum tersedia 😅')}
                    >
                      Lupa password?
                    </button>
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={loading}
                      className="pl-9 pr-9"
                      aria-invalid={!!error}
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
                </div>

                {/* Inline error */}
                {error && (
                  <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">
                    {error}
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
                      Memproses...
                    </>
                  ) : (
                    'Masuk'
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Footer link */}
          <p className="text-center text-sm text-muted-foreground mt-6">
            Belum punya akun?{' '}
            <button
              onClick={() => navigate('register')}
              className="text-primary font-semibold hover:underline"
            >
              Daftar
            </button>
          </p>
        </motion.div>
      </main>
    </div>
  )
}
