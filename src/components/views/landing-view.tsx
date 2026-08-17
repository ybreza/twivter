'use client'

import { motion } from 'framer-motion'
import { TwivterLogo, TwivterWordmark } from '@/components/twivter-logo'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useViewStore } from '@/stores/app-store'
import {
  Sparkles,
  Users,
  Globe,
  Zap,
  MessageCircle,
  Heart,
  Hash,
  Moon,
  ArrowRight,
  Check,
} from 'lucide-react'

const FEATURES = [
  {
    icon: Zap,
    title: 'Realtime',
    desc: 'Update langsung tanpa refresh. Posting, like, komentar — semuanya instan lewat WebSocket.',
    color: 'from-blue-500 to-cyan-400',
  },
  {
    icon: Users,
    title: 'Komunitas',
    desc: 'Bangun komunitas dengan minat yang sama. Atur topik, ajak anggota, dan tumbuh bareng.',
    color: 'from-purple-500 to-pink-400',
  },
  {
    icon: Globe,
    title: 'Open Feed',
    desc: 'Feed yang transparan. Eksplor tanpa algoritma biadab. Lihat yang terbaru dan yang sedang ramai.',
    color: 'from-emerald-500 to-teal-400',
  },
  {
    icon: Moon,
    title: 'Dark Mode',
    desc: 'Mata kamu berharga. Mode gelap native, hemat baterai, dan tetap nyaman dipandang berjam-jam.',
    color: 'from-indigo-500 to-violet-400',
  },
]

const STATS = [
  { label: 'Pengguna aktif', value: '12K+' },
  { label: 'Postingan per hari', value: '48K' },
  { label: 'Komunitas', value: '320' },
  { label: 'Uptime', value: '99.9%' },
]

const TESTIMONIALS = [
  {
    name: 'Sara Putri',
    username: 'sara_dev',
    text: 'Akhirnya platform lokal yang cepat dan nggak berat. Feed-nya bersih, fiturnya lengkap!',
    avatarColor: 'bg-purple-500',
  },
  {
    name: 'Bagus Pratama',
    username: 'baguscode',
    text: 'Realtime-nya beneran realtime. Ngetik komentar muncul langsung tanpa reload.',
    avatarColor: 'bg-emerald-500',
  },
  {
    name: 'Maya Hartono',
    username: 'mayaph',
    text: 'UI-nya cantik banget, dark mode-nya enak dilihat. Recommended buat anak kreatif.',
    avatarColor: 'bg-amber-500',
  },
]

export function LandingView() {
  const navigate = useViewStore((s) => s.navigate)

  return (
    <div className="min-h-screen flex flex-col bg-background overflow-x-hidden">
      {/* ── Animated gradient background ─────────────── */}
      <div className="fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-40 -right-32 h-96 w-96 rounded-full bg-primary/20 blur-3xl animate-pulse" />
        <div className="absolute top-1/3 -left-32 h-96 w-96 rounded-full bg-purple-500/20 blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute bottom-0 right-1/4 h-80 w-80 rounded-full bg-cyan-400/10 blur-3xl animate-pulse" style={{ animationDelay: '2s' }} />
        {/* Grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.04] dark:opacity-[0.07]"
          style={{
            backgroundImage:
              'linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        />
      </div>

      {/* ── Top nav ─────────────────────────────────── */}
      <header className="sticky top-0 z-40 w-full">
        <div className="container mx-auto flex items-center justify-between px-4 sm:px-6 py-3 backdrop-blur-xl bg-background/70 border-b border-border/60">
          <button
            onClick={() => navigate('landing')}
            className="flex items-center gap-2.5 group"
            aria-label="Twivter home"
          >
            <TwivterLogo size={36} className="transition-transform group-hover:scale-110" />
            <TwivterWordmark className="text-2xl" />
          </button>
          <nav className="flex items-center gap-2">
            <Button
              variant="ghost"
              onClick={() => navigate('login')}
              className="rounded-full font-semibold"
            >
              Masuk
            </Button>
            <Button
              onClick={() => navigate('register')}
              className="rounded-full font-semibold px-5 bg-gradient-to-r from-blue-500 to-purple-500 hover:opacity-90"
            >
              Daftar
            </Button>
          </nav>
        </div>
      </header>

      {/* ── Hero ────────────────────────────────────── */}
      <section className="flex-1 flex items-center justify-center px-4 sm:px-6 pt-12 pb-20 sm:pt-20 sm:pb-32">
        <div className="container mx-auto max-w-5xl text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="inline-flex items-center gap-2 px-4 py-1.5 mb-6 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs sm:text-sm font-medium"
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>Generasi baru social media Indonesia</span>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7, delay: 0.1 }}
            className="flex justify-center mb-6"
          >
            <TwivterLogo size={80} className="drop-shadow-2xl" />
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-4xl sm:text-6xl lg:text-7xl font-bold tracking-tight mb-6"
          >
            <span className="text-gradient-twivter">Connect.</span>{' '}
            <span className="text-gradient-twivter">Share.</span>{' '}
            <span className="text-gradient-twivter">Discover.</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="text-base sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-10"
          >
            Twivter adalah tempat di mana kamu terhubung dengan komunitas, berbagi momen, dan
            menemukan hal-hal baru — semuanya dalam satu platform yang cepat, modern, dan ramah.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-10"
          >
            <Button
              size="lg"
              onClick={() => navigate('register')}
              className="w-full sm:w-auto rounded-full font-semibold px-8 h-12 text-base bg-gradient-to-r from-blue-500 to-purple-500 hover:opacity-90 shadow-lg shadow-primary/25"
            >
              Mulai sekarang
              <ArrowRight className="h-4 w-4" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() => navigate('login')}
              className="w-full sm:w-auto rounded-full font-semibold px-8 h-12 text-base"
            >
              Saya sudah punya akun
            </Button>
          </motion.div>

          {/* Mini stats */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.5 }}
            className="grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-2xl mx-auto"
          >
            {STATS.map((s) => (
              <div
                key={s.label}
                className="flex flex-col items-center p-3 rounded-2xl bg-card/50 backdrop-blur border border-border/60"
              >
                <span className="text-2xl sm:text-3xl font-bold text-gradient-twivter">
                  {s.value}
                </span>
                <span className="text-xs text-muted-foreground mt-1">{s.label}</span>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── Features ────────────────────────────────── */}
      <section className="px-4 sm:px-6 py-16 sm:py-24 border-t border-border/60 bg-card/30 backdrop-blur">
        <div className="container mx-auto max-w-6xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl sm:text-5xl font-bold mb-3">
              Kenapa <TwivterWordmark className="text-4xl sm:text-5xl" />?
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Dibangun dari nol dengan teknologi terkini untuk pengalaman terbaik.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {FEATURES.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.08 }}
              >
                <Card className="h-full hover:shadow-lg hover:-translate-y-1 transition-all duration-300 hover:border-primary/40">
                  <CardContent className="flex flex-col items-start gap-3 px-5">
                    <div className={`p-2.5 rounded-xl bg-gradient-to-br ${f.color} text-white shadow-lg`}>
                      <f.icon className="h-5 w-5" />
                    </div>
                    <h3 className="font-semibold text-lg">{f.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Phone-like preview mock ─────────────────── */}
      <section className="px-4 sm:px-6 py-16 sm:py-24">
        <div className="container mx-auto max-w-5xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-center mb-10"
          >
            <h2 className="text-3xl sm:text-4xl font-bold mb-2">Tampil seperti ini</h2>
            <p className="text-muted-foreground">Clean, modern, fokus ke konten yang penting.</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="max-w-md mx-auto rounded-[2rem] border-4 border-foreground/10 bg-card shadow-2xl overflow-hidden"
          >
            {/* Mock header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border/60">
              <div className="flex items-center gap-2">
                <TwivterLogo size={24} />
                <span className="font-bold">Beranda</span>
              </div>
              <div className="h-7 w-7 rounded-full bg-gradient-to-br from-blue-500 to-purple-500" />
            </div>

            {/* Mock post */}
            <div className="p-4 space-y-3">
              <div className="flex gap-3">
                <div className="h-10 w-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 shrink-0" />
                <div className="flex-1 space-y-2 min-w-0">
                  <div className="flex items-center gap-1.5 text-sm">
                    <span className="font-semibold truncate">Sara Putri</span>
                    <Check className="h-3.5 w-3.5 text-primary shrink-0" />
                    <span className="text-muted-foreground text-xs truncate">@sara_dev · 2m</span>
                  </div>
                  <p className="text-sm leading-relaxed">
                    Baru aja coba Twivter. Ngerasa beda banget — cepat, bersih, dan
                    realtime-nya beneran realtime 🔥
                  </p>
                  <div className="flex items-center gap-5 pt-1 text-muted-foreground text-xs">
                    <span className="flex items-center gap-1">
                      <MessageCircle className="h-3.5 w-3.5" /> 24
                    </span>
                    <span className="flex items-center gap-1">
                      <Hash className="h-3.5 w-3.5" /> 8
                    </span>
                    <span className="flex items-center gap-1 text-pink-500">
                      <Heart className="h-3.5 w-3.5 fill-pink-500" /> 142
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-2 border-t border-border/60">
                <div className="h-10 w-10 rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 shrink-0" />
                <div className="flex-1 space-y-2 min-w-0">
                  <div className="flex items-center gap-1.5 text-sm">
                    <span className="font-semibold truncate">Bagus Pratama</span>
                    <span className="text-muted-foreground text-xs truncate">@baguscode · 5m</span>
                  </div>
                  <p className="text-sm leading-relaxed">
                    Setuju! Tech stack-nya Next.js 16 + WebSocket. Mantap.
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── Testimonials ────────────────────────────── */}
      <section className="px-4 sm:px-6 py-16 sm:py-24 bg-card/30 backdrop-blur border-t border-border/60">
        <div className="container mx-auto max-w-5xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl sm:text-4xl font-bold mb-2">Kata mereka</h2>
            <p className="text-muted-foreground">Cerita pengguna Twivter yang sudah naik kelas.</p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {TESTIMONIALS.map((t, i) => (
              <motion.div
                key={t.username}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
              >
                <Card className="h-full">
                  <CardContent className="flex flex-col gap-4 px-5">
                    <p className="text-sm leading-relaxed text-foreground/90">"{t.text}"</p>
                    <div className="flex items-center gap-3 mt-auto">
                      <div
                        className={`h-9 w-9 rounded-full ${t.avatarColor} flex items-center justify-center text-white text-xs font-semibold`}
                      >
                        {t.name.split(' ').map((n) => n[0]).join('')}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-sm truncate">{t.name}</p>
                        <p className="text-xs text-muted-foreground truncate">@{t.username}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Final CTA ───────────────────────────────── */}
      <section className="px-4 sm:px-6 py-16 sm:py-24">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="container mx-auto max-w-3xl"
        >
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 p-8 sm:p-14 text-center text-white shadow-2xl">
            {/* Decorative blobs */}
            <div className="absolute -top-12 -right-12 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
            <div className="absolute -bottom-12 -left-12 h-40 w-40 rounded-full bg-white/10 blur-2xl" />

            <div className="relative">
              <h2 className="text-3xl sm:text-5xl font-bold mb-4">
                Siap bergabung?
              </h2>
              <p className="text-white/90 max-w-xl mx-auto mb-8">
                Daftar cuma butuh 30 detik. Gratis, tanpa iklan mengganggu, tanpa algoritma
                biadab.
              </p>
              <Button
                size="lg"
                onClick={() => navigate('register')}
                className="bg-white text-purple-600 hover:bg-white/90 rounded-full font-bold px-8 h-12 text-base shadow-xl"
              >
                Buat akun saya sekarang
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </motion.div>
      </section>

      {/* ── Footer ──────────────────────────────────── */}
      <footer className="mt-auto px-4 sm:px-6 py-8 border-t border-border/60 bg-background">
        <div className="container mx-auto max-w-6xl flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <TwivterLogo size={24} />
            <span className="text-sm text-muted-foreground">
              © {new Date().getFullYear()} Twivter. Dibuat dengan ❤️ di Indonesia.
            </span>
          </div>
          <nav className="flex items-center gap-5 text-xs text-muted-foreground">
            <a href="#" className="hover:text-foreground transition-colors">Tentang</a>
            <a href="#" className="hover:text-foreground transition-colors">Privasi</a>
            <a href="#" className="hover:text-foreground transition-colors">Syarat</a>
            <a href="#" className="hover:text-foreground transition-colors">Bantuan</a>
          </nav>
        </div>
      </footer>
    </div>
  )
}
