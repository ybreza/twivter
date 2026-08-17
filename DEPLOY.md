# Twivter — Deployment Guide

Panduan lengkap deploy platform social media **Twivter** dari nol hingga produksi.

> **Twivter** adalah platform microblogging bergaya Twitter/X yang dibangun dengan Next.js 16 (App Router), TypeScript, Prisma (SQLite/PostgreSQL), dan socket.io untuk realtime Direct Messages.

---

## Daftar Isi

1. [Prasyarat](#1-prasyarat)
2. [Arsitektur Sistem](#2-arsitektur-sistem)
3. [Stage 1 — Setup Project & Dependencies](#stage-1--setup-project--dependencies)
4. [Stage 2 — Konfigurasi Database & Schema](#stage-2--konfigurasi-database--schema)
5. [Stage 3 — Environment Variables](#stage-3--environment-variables)
6. [Stage 4 — Menjalankan Secara Lokal (Development)](#stage-4--menjalankan-secara-lokal-development)
7. [Stage 5 — Seed Data Demo](#stage-5--seed-data-demo)
8. [Stage 6 — Build untuk Produksi](#stage-6--build-untuk-produksi)
9. [Stage 7 — Deploy ke Vercel (Frontend + API)](#stage-7--deploy-ke-vercel-frontend--api)
10. [Stage 8 — Deploy Chat Service (Realtime DM)](#stage-8--deploy-chat-service-realtime-dm)
11. [Stage 9 — Migrasi Database ke PostgreSQL](#stage-9--migrasi-database-ke-postgresql)
12. [Stage 10 — Setup Object Storage untuk Upload](#stage-10--setup-object-storage-untuk-upload)
13. [Stage 11 — Konfigurasi Domain & Gateway](#stage-11--konfigurasi-domain--gateway)
14. [Stage 12 — Post-Deploy Checklist](#stage-12--post-deploy-checklist)
15. [Troubleshooting](#troubleshooting)

---

## 1. Prasyarat

| Tool | Versi | Keterangan |
|---|---|---|
| **Node.js** | ≥ 20.x | Runtime JavaScript |
| **Bun** | ≥ 1.1 | Package manager & runtime (recommended) |
| **PostgreSQL** | ≥ 14 | Database produksi (dev pakai SQLite) |
| **Git** | ≥ 2.40 | Version control |
| **Vercel CLI** | latest | `npm i -g vercel` |
| **Docker** | ≥ 24 | Untuk chat-service (opsional) |

Akun layanan:
- [Vercel](https://vercel.com) — hosting Next.js
- [Supabase](https://supabase.com) atau [Neon](https://neon.tech) — PostgreSQL managed
- [Cloudflare R2](https://developers.cloudflare.com/r2/) / [AWS S3](https://aws.amazon.com/s3/) — object storage untuk upload avatar/cover/post media
- [Railway](https://railway.app) / [Render](https://render.com) / [Fly.io](https://fly.io) — hosting chat-service (socket.io)

---

## 2. Arsitektur Sistem

```
                    ┌──────────────────────────────────────┐
                    │           BROWSER (User)              │
                    │   Single-page app di route /          │
                    │   (view-switching via Zustand)        │
                    └──────────┬───────────────┬────────────┘
                               │ HTTP/REST     │ WebSocket
                               ▼               ▼
                    ┌─────────────────┐  ┌──────────────────┐
                    │  Next.js 16     │  │  Chat Service     │
                    │  (Vercel)       │  │  (socket.io)      │
                    │  Port 3000      │  │  Port 3003        │
                    │                 │  │                   │
                    │  - App Router   │  │  - Realtime DM    │
                    │  - API routes   │  │  - Typing indicator│
                    │  - SSR/SSG     │  │  - Presence       │
                    │  - Image upload │  │                   │
                    └───────┬─────────┘  └────────┬──────────┘
                            │                     │
                            ▼                     │
                    ┌─────────────────┐           │
                    │  PostgreSQL     │◄──────────┘
                    │  (Supabase/Neon) │  (chat service reads
                    │                  │   conversation members
                    │  15 tabel:       │   for fan-out)
                    │  User, Post,     │
                    │  Follow, Like,   │
                    │  Comment, etc.   │
                    └─────────────────┘
                            │
                            ▼
                    ┌─────────────────┐
                    │  Object Storage  │
                    │  (R2/S3)         │
                    │                  │
                    │  - /avatars/     │
                    │  - /covers/      │
                    │  - /posts/       │
                    └─────────────────┘
```

**Komponen utama:**

| Komponen | Teknologi | Port | Hosting |
|---|---|---|---|
| Frontend + API | Next.js 16 (App Router) | 3000 | Vercel |
| Realtime DM | socket.io (Bun) | 3003 | Railway/Render/Fly.io |
| Database | PostgreSQL (Prisma ORM) | 5432 | Supabase/Neon |
| Object Storage | S3-compatible | 443 | Cloudflare R2 / AWS S3 |
| Gateway/CDN | Caddy (dev) / Vercel CDN (prod) | 80/443 | — |

---

## Stage 1 — Setup Project & Dependencies

### 1.1 Clone & install

```bash
git clone <repo-url> twivter
cd twivter
bun install
```

### 1.2 Dependencies yang sudah terpasang

```json
{
  "dependencies": {
    "next": "^16.1.1",
    "react": "^19.0.0",
    "typescript": "^5",
    "tailwindcss": "^4",
    "@prisma/client": "^6.11.1",
    "prisma": "^6.11.1",
    "bcryptjs": "^3.0.3",        // password hashing
    "jose": "^6.2.9",            // JWT session tokens
    "socket.io": "^4.8.3",       // realtime server
    "socket.io-client": "^4.8.3",// realtime client
    "sharp": "^0.34.3",          // image compression
    "zustand": "^5.0.6",         // state management
    "@tanstack/react-query": "^5.82.0",
    "framer-motion": "^12.23.2", // animations
    "recharts": "^2.15.4",       // admin charts
    "sonner": "^2.0.6",          // toast notifications
    "lucide-react": "^0.525.0",  // icons
    "zod": "^4.0.2"              // validation
  }
}
```

> shadcn/ui (New York style) sudah terpasang di `src/components/ui/`.

### 1.3 Install chat-service dependencies

```bash
cd mini-services/chat-service
bun install
cd ../..
```

---

## Stage 2 — Konfigurasi Database & Schema

### 2.1 Schema Prisma

File: `prisma/schema.prisma` — berisi **15 model**:

| Model | Keterangan |
|---|---|
| `User` | Profil user (id, email, username, displayName, bio, avatar, cover, role, verified, onboarded, interests) |
| `Session` | Token sesi JWT (untuk revocation jika perlu) |
| `Post` | Konten post (text, replyToId, quotePostId) |
| `PostMedia` | Lampiran gambar/video per post |
| `Like` | Like pada post (unique constraint postId+userId) |
| `Bookmark` | Bookmark post |
| `Repost` | Repost post |
| `Comment` | Komentar (juga sebagai reply via Post.replyToId) |
| `Follow` | Relasi follow (followerId + followingId) |
| `Notification` | Notifikasi (like, comment, repost, follow, mention) |
| `Conversation` | Percakapan DM (private / group) |
| `ConversationMember` | Anggota percakapan + lastReadAt |
| `Message` | Pesan DM |
| `Community` | Komunitas (name, slug, description, owner) |
| `CommunityMember` | Anggota komunitas (role: owner/admin/member) |
| `Report` | Laporan user/post untuk moderasi |
| `Verification` | Request verifikasi badge |

### 2.2 Push schema ke database

**Development (SQLite):**
```bash
bun run db:push
```
Ini membuat file `db/custom.db` (SQLite) sesuai schema.

**Produksi (PostgreSQL) — lihat Stage 9.**

### 2.3 Generate Prisma Client

```bash
bun run db:generate
```
Ini sudah otomatis dijalankan oleh `db:push`, tapi jalankan manual jika mengubah schema.

---

## Stage 3 — Environment Variables

### 3.1 File `.env` (development)

```env
# Database (SQLite untuk dev)
DATABASE_URL="file:./db/custom.db"

# JWT secret untuk session token — GANTI di produksi!
SESSION_SECRET="twivter-dev-secret-change-in-production-please"

# Upload dir (lokal untuk dev)
UPLOAD_DIR="./public/uploads"
```

### 3.2 File `.env.production` (produksi)

```env
# Database (PostgreSQL)
DATABASE_URL="postgresql://user:password@host:5432/twivter?sslmode=require"

# JWT secret — generate dengan: openssl rand -base64 32
SESSION_SECRET="your-super-secret-random-string-here"

# Object Storage (S3-compatible)
S3_ENDPOINT="https://xxx.r2.cloudflarestorage.com"
S3_BUCKET="twivter-uploads"
S3_ACCESS_KEY="your-access-key"
S3_SECRET_KEY="your-secret-key"
S3_PUBLIC_URL="https://uploads.twivter.com"

# Chat service URL (untuk referensi, frontend pakai gateway)
CHAT_SERVICE_URL="https://chat.twivter.com"

# App URL
NEXT_PUBLIC_APP_URL="https://twivter.com"
```

### 3.3 Chat-service `.env`

File: `mini-services/chat-service/.env`
```env
PORT=3003
CORS_ORIGIN="https://twivter.com"
```

---

## Stage 4 — Menjalankan Secara Lokal (Development)

### 4.1 Start Next.js dev server

```bash
bun run dev
```
Server berjalan di `http://localhost:3000`.

### 4.2 Start chat-service (realtime DM)

```bash
cd mini-services/chat-service
bun run dev
```
Socket.io server berjalan di `http://localhost:3003`.

> **Penting:** Frontend terhubung ke chat-service via gateway: `io('/?XTransformPort=3003')`. JANGAN gunakan `io('http://localhost:3003')` langsung.

### 4.3 Akses aplikasi

Buka **Preview Panel** di sebelah kanan interface, atau klik **"Open in New Tab"**.

**Demo accounts** (setelah seed):
| Email | Password | Role |
|---|---|---|
| yowanda@twivter.com | password123 | admin |
| sara@twivter.com | password123 | user (verified) |
| bagus@twivter.com | password123 | user |
| maya@twivter.com | password123 | user (verified) |

---

## Stage 5 — Seed Data Demo

Seed mengisi database dengan 8 user, 13 post, follow graph, likes/reposts/comments, notifications, 4 communities, 3 conversations, 2 reports, dan 2 verification requests.

```bash
bun run seed
```

Output:
```
🌱 Seeding Twivter database...
✅ Seed complete!
   8 users, 13 posts, 4 communities
   Demo login: yowanda@twivter.com / password123
```

> **Untuk reset database:** `bun run db:push` (dengan `--accept-data-loss`) lalu `bun run seed`.

---

## Stage 6 — Build untuk Produksi

### 6.1 Build Next.js

```bash
bun run build
```
Ini menghasilkan:
- `.next/standalone/` — server standalone (untuk deployment tanpa Vercel)
- `.next/static/` — aset statis
- Optimized production build

### 6.2 Jalankan production build lokal

```bash
bun run start
```

### 6.3 Lint check

```bash
bun run lint
```
Pastikan 0 errors sebelum deploy.

---

## Stage 7 — Deploy ke Vercel (Frontend + API)

### 7.1 Via Vercel CLI

```bash
# Login
vercel login

# Deploy dari root project
vercel

# Ikuti prompt:
# - Set up and deploy? Y
# - Which scope? (pilih akun)
# - Link to existing project? N
# - Project name? twivter
# - Framework preset? Next.js
# - Root directory? ./
# - Build command? (default)
# - Output directory? (default)
```

### 7.2 Set environment variables di Vercel

```bash
vercel env add DATABASE_URL production
vercel env add SESSION_SECRET production
vercel env add S3_ENDPOINT production
vercel env add S3_BUCKET production
vercel env add S3_ACCESS_KEY production
vercel env add S3_SECRET_KEY production
vercel env add S3_PUBLIC_URL production
vercel env add NEXT_PUBLIC_APP_URL production
```

Atau via dashboard: **Settings → Environment Variables**.

### 7.3 Production deploy

```bash
vercel --prod
```

### 7.4 Via Vercel Dashboard (alternatif)

1. Push repo ke GitHub.
2. Buka [vercel.com/new](https://vercel.com/new).
3. Import repository.
4. Framework preset: **Next.js** (auto-detected).
5. Add semua environment variables (Stage 3.2).
6. Click **Deploy**.

### 7.5 Konfigurasi `next.config.ts`

File `next.config.ts` sudah dikonfigurasi untuk Vercel. Pastikan:

```typescript
const nextConfig = {
  output: 'standalone', // untuk deployment fleksibel
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'uploads.twivter.com' },
      { protocol: 'https', hostname: 'images.unsplash.com' }, // demo images
    ],
  },
}
```

---

## Stage 8 — Deploy Chat Service (Realtime DM)

Chat-service adalah **mini-service terpisah** (Bun + socket.io) yang menangani realtime Direct Messages.

### 8.1 Struktur

```
mini-services/chat-service/
├── package.json    # independent bun project
├── index.ts        # socket.io server (port 3003)
└── .env            # CORS_ORIGIN, PORT
```

### 8.2 Deploy ke Railway

```bash
# Install Railway CLI
npm i -g @railway/cli
railway login

# Dari mini-services/chat-service/
cd mini-services/chat-service
railway init        # buat project baru
railway up          # deploy

# Set environment variables
railway variables set CORS_ORIGIN=https://twivter.com
railway variables set PORT=3003

# Dapatkan URL
railway domain      # contoh: chat-service-production.up.railway.app
```

### 8.3 Deploy ke Render

1. Buka [render.com](https://render.com) → New → Web Service.
2. Connect repository.
3. Settings:
   - **Root Directory:** `mini-services/chat-service`
   - **Build Command:** `bun install`
   - **Start Command:** `bun run index.ts`
   - **Environment:** `CORS_ORIGIN=https://twivter.com`
4. Deploy.

### 8.4 Deploy ke Fly.io

```bash
cd mini-services/chat-service
fly launch
fly deploy
fly secrets set CORS_ORIGIN=https://twivter.com
```

### 8.5 Update frontend untuk produksi

Setelah chat-service live di production URL (mis. `https://chat.twivter.com`), update gateway/reverse-proxy untuk forward `/socket.io/` ke chat-service.

**Atau** ubah frontend connection di `src/components/messages/use-chat-socket.ts`:

```typescript
// Development (via gateway):
const socket = io('/?XTransformPort=3003', { path: '/', transports: ['websocket','polling'] })

// Production (direct URL):
const socket = io('https://chat.twivter.com', {
  path: '/socket.io/',
  transports: ['websocket','polling'],
  withCredentials: true,
})
```

> **Rekomendasi:** Gunakan reverse proxy (Caddy/Nginx) agar chat-service bisa diakses via subpath/subdomain yang sama dengan origin frontend (menghindari CORS issues).

---

## Stage 9 — Migrasi Database ke PostgreSQL

Development pakai SQLite; produksi wajib PostgreSQL untuk konkurensi & skalabilitas.

### 9.1 Buat database PostgreSQL

**Supabase:**
1. Buka [supabase.com](https://supabase.com) → New Project.
2. Pilih region terdekat.
3. Dapat connection string: `postgresql://postgres:[password]@db.[project].supabase.co:5432/postgres`

**Neon:**
1. Buka [neon.tech](https://neon.tech) → New Project.
2. Dapat connection string pooled.

### 9.2 Update `prisma/schema.prisma`

```prisma
datasource db {
  provider = "postgresql"    // ← ubah dari "sqlite"
  url      = env("DATABASE_URL")
}
```

### 9.3 Update `.env`

```env
DATABASE_URL="postgresql://postgres:password@db.xxx.supabase.co:5432/postgres"
```

### 9.4 Push schema & migrate

```bash
bun run db:push
# atau buat migration:
bun run db:migrate
```

### 9.5 Case-insensitive username (PostgreSQL)

SQLite case-insensitive by default untuk ASCII. PostgreSQL case-sensitive. Untuk username case-insensitive di PostgreSQL, tambahkan unique index:

```sql
CREATE UNIQUE INDEX profiles_username_unique
ON "User" (LOWER(username));
```

Atau update Prisma query di `src/lib/auth.ts` dan `src/app/api/profiles/[username]/route.ts` untuk menggunakan `mode: 'insensitive'`:

```typescript
const user = await db.user.findFirst({
  where: { username: { equals: username, mode: 'insensitive' } }
})
```

### 9.6 Seed production database

```bash
NODE_ENV=production bun run seed
```

---

## Stage 10 — Setup Object Storage untuk Upload

Development menyimpan upload di `public/uploads/`. Produksi wajib object storage (S3/R2) untuk persistensi & CDN.

### 10.1 Cloudflare R2 (recommended — no egress fee)

1. Buka [Cloudflare Dashboard → R2](https://dash.cloudflare.com).
2. Create bucket: `twivter-uploads`.
3. Create API token (R2 → Manage R2 API Tokens).
4. Dapat: endpoint, access key, secret key.

### 10.2 Update upload route

File: `src/app/api/upload/route.ts`

Ganti `writeFile` (filesystem) dengan S3 SDK:

```bash
bun add @aws-sdk/client-s3
```

```typescript
// src/lib/storage.ts
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import sharp from 'sharp'

const s3 = new S3Client({
  region: 'auto',
  endpoint: process.env.S3_ENDPOINT,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY!,
    secretAccessKey: process.env.S3_SECRET_KEY!,
  },
})

export async function uploadFile(buffer: Buffer, key: string, contentType: string) {
  await s3.send(new PutObjectCommand({
    Bucket: process.env.S3_BUCKET,
    Key: key,
    Body: buffer,
    ContentType: contentType,
  }))
  return `${process.env.S3_PUBLIC_URL}/${key}`
}
```

Update `src/app/api/upload/route.ts`:
```typescript
import { uploadFile } from '@/lib/storage'

// Ganti writeFile dengan:
const processed = await sharp(buffer).resize(400, 400, { fit: 'cover' }).webp().toBuffer()
const url = await uploadFile(processed, `${bucket}/${fileName}`, 'image/webp')
```

### 10.3 Public URL setup

Set bucket ke **public** atau gunakan presigned URL. Untuk R2:
1. Settings → Public access → Enable.
2. Bind custom domain: `uploads.twivter.com`.

---

## Stage 11 — Konfigurasi Domain & Gateway

### 11.1 Domain setup

| Subdomain | Target | Keterangan |
|---|---|---|
| `twivter.com` | Vercel | Next.js app |
| `chat.twivter.com` | Railway/Render | Chat-service (socket.io) |
| `uploads.twivter.com` | R2 public | Object storage CDN |

### 11.2 DNS records

```
twivter.com           A     76.76.21.21     (Vercel)
chat.twivter.com      CNAME chat-service.railway.app
uploads.twivter.com   CNAME pub-xxx.r2.dev
```

### 11.3 Caddy reverse proxy (opsional, untuk self-host)

Jika tidak pakai Vercel dan self-host dengan Caddy:

```caddyfile
twivter.com {
    # Next.js app
    handle /socket.io/* {
        reverse_proxy chat-service:3003
    }
    handle {
        reverse_proxy nextjs:3000
    }
}
```

Ini menyatukan frontend + chat-service di origin yang sama (menghindari CORS).

### 11.4 SSL/TLS

- **Vercel:** otomatis (Let's Encrypt).
- **Self-host Caddy:** otomatis (Let's Encrypt).
- **Cloudflare:** aktifkan "Full (strict)" SSL.

---

## Stage 12 — Post-Deploy Checklist

Setelah deploy, verifikasi:

### 12.1 Smoke test

- [ ] `https://twivter.com` load landing page.
- [ ] Register akun baru → onboarding → home feed.
- [ ] Login dengan demo account.
- [ ] Buat post dengan teks → muncul di feed.
- [ ] Buat post dengan gambar → upload berhasil.
- [ ] Like sebuah post → count naik.
- [ ] Bookmark post → muncul di /bookmarks.
- [ ] Follow user lain → count berubah.
- [ ] Buka profile user lain → Follow/Following toggle.
- [ ] Edit profile sendiri → upload avatar/cover.
- [ ] Buka Explore → trending + suggested users.
- [ ] Search "twivter" → hasil muncul.
- [ ] Buka Notifications → list notifikasi.
- [ ] Buka Messages → conversation list.
- [ ] Kirim DM → pesan muncul realtime.
- [ ] Buka Communities → join community.
- [ ] Buka Settings → ganti theme (dark mode).
- [ ] Buka Admin (sebagai admin) → stats + reports.

### 12.2 Performance

- [ ] Lighthouse score > 90 (Performance, Accessibility, Best Practices, SEO).
- [ ] LCP < 2.5s.
- [ ] FID < 100ms.
- [ ] CLS < 0.1.

### 12.3 Security

- [ ] `SESSION_SECRET` adalah random string ≥ 32 bytes.
- [ ] `service_role` / `S3_SECRET_KEY` tidak terekspos di frontend.
- [ ] Cookies: `httpOnly: true`, `secure: true` (production), `sameSite: 'lax'`.
- [ ] CORS: chat-service hanya menerima origin `twivter.com`.
- [ ] Rate limiting pada `/api/auth/login` dan `/api/auth/register` (gunakan `@upstash/ratelimit`).
- [ ] Input validation pada semua API routes (zod).

### 12.4 Monitoring

- [ ] Setup [Sentry](https://sentry.io) untuk error tracking.
- [ ] Setup [Vercel Analytics](https://vercel.com/analytics) untuk web vitals.
- [ ] Setup database backup (Supabase: automatic daily; Neon: point-in-time recovery).
- [ ] Log aggregation (optional: Logtail, Datadog).

---

## Troubleshooting

### Server tidak bisa connect dari curl tapi bisa dari browser

Sandbox/dev environment kadang punya network isolation. Gunakan browser (Preview Panel) untuk testing, atau pastikan server bind ke `0.0.0.0`:

```bash
next dev -H 0.0.0.0 -p 3000
```

### `prisma:query` logging terlalu verbose

Edit `src/lib/db.ts`:
```typescript
new PrismaClient({ log: ['error', 'warn'] })  // hapus 'query'
```

### Socket.io connection refused

1. Pastikan chat-service berjalan: `curl http://localhost:3003/socket.io/?EIO=4&transport=polling` → harus return `0{"sid":...}`.
2. Pastikan frontend connect via `io('/?XTransformPort=3003')` BUKAN `io('http://localhost:3003')`.
3. Check CORS: chat-service harus allow origin frontend.

### Upload gagal

1. Pastikan `public/uploads/` writable: `chmod -R 755 public/uploads/`.
2. Check file size limit (avatar 5MB, cover 10MB, post 5MB).
3. Check format (JPEG, PNG, WEBP, GIF only).
4. Produksi: pastikan S3 credentials valid.

### Database migration gagal

```bash
# Reset database (HATI-HATI: hapus semua data)
bun run db:reset

# Atau push ulang
bun run db:push --accept-data-loss
bun run seed
```

### Hydration mismatch

Pastikan komponen yang pakai `window`, `localStorage`, atau `Date.now()` di-mark `'use client'` dan dibungkus `useEffect` atau `typeof window !== 'undefined'` check.

### Build error di Vercel

1. Pastikan `DATABASE_URL` environment variable set di Vercel.
2. Jalankan `bun run db:push` sebelum build jika perlu.
3. Check `next.config.ts` — `output: 'standalone'` untuk Vercel tidak wajib (Vercel handle otomatis).

---

## Quick Reference — Commands

```bash
# Development
bun run dev                    # Next.js dev server (port 3000)
cd mini-services/chat-service && bun run dev  # Chat-service (port 3003)
bun run lint                   # ESLint check
bun run db:push                # Push schema ke DB
bun run db:generate            # Generate Prisma Client
bun run seed                   # Seed demo data

# Production
bun run build                  # Build Next.js
bun run start                  # Run production build
vercel --prod                  # Deploy ke Vercel
```

---

## Struktur Folder

```
twivter/
├── prisma/
│   └── schema.prisma              # 15 model database
├── scripts/
│   └── seed.ts                    # Seed demo data
├── src/
│   ├── app/
│   │   ├── api/                   # 40+ API routes (REST)
│   │   │   ├── auth/              # register, login, logout, me, check-username
│   │   │   ├── posts/             # CRUD + like/bookmark/repost/comments
│   │   │   ├── profiles/          # by username + me + posts
│   │   │   ├── follow/            # follow/unfollow
│   │   │   ├── conversations/     # DM list + messages + read
│   │   │   ├── notifications/     # list + read
│   │   │   ├── explore/           # trending + suggestions
│   │   │   ├── search/            # posts/users/communities
│   │   │   ├── communities/       # CRUD + join
│   │   │   ├── admin/             # stats, reports, verifications, users
│   │   │   ├── reports/           # file report
│   │   │   ├── onboarding/        # complete onboarding
│   │   │   └── upload/            # image upload (sharp)
│   │   ├── globals.css            # Twivter theme (Blue/Purple, 14px radius)
│   │   ├── layout.tsx             # Inter font + Providers + Toaster
│   │   └── page.tsx               # SPA entry (view router)
│   ├── components/
│   │   ├── ui/                    # shadcn/ui (40+ components)
│   │   ├── layout/                # AppShell, TrendingSidebar
│   │   ├── post/                  # PostCard, PostComposer, ComposeDialog
│   │   ├── profile/               # EditProfileDialog
│   │   ├── messages/              # useChatSocket hook
│   │   ├── views/                 # 13 view components
│   │   │   ├── landing-view.tsx
│   │   │   ├── login-view.tsx
│   │   │   ├── register-view.tsx
│   │   │   ├── onboarding-view.tsx
│   │   │   ├── home-view.tsx
│   │   │   ├── explore-view.tsx
│   │   │   ├── notifications-view.tsx
│   │   │   ├── messages-view.tsx
│   │   │   ├── bookmarks-view.tsx
│   │   │   ├── communities-view.tsx
│   │   │   ├── profile-view.tsx
│   │   │   ├── post-detail-view.tsx
│   │   │   ├── settings-view.tsx
│   │   │   └── admin-view.tsx
│   │   ├── providers.tsx          # React Query + theme + session bootstrap
│   │   ├── twivter-logo.tsx       # Logo SVG + wordmark
│   │   ├── user-avatar.tsx        # Avatar with verified badge
│   │   └── shared-states.tsx      # ViewHeader, EmptyState, LoadingState, Skeletons
│   ├── lib/
│   │   ├── auth.ts                # bcrypt + jose JWT + cookie helpers
│   │   ├── api.ts                 # response helpers + withErrorHandler
│   │   ├── db.ts                  # Prisma client
│   │   ├── serialize.ts           # DTO serializers (Post, Profile, etc.)
│   │   ├── types.ts               # shared TypeScript types
│   │   ├── hooks.ts               # useApi, apiPost, apiPatch, apiDelete
│   │   └── utils.ts               # cn, slugify, getInitials, etc.
│   └── stores/
│       └── app-store.ts           # Zustand: auth, view router, theme
├── mini-services/
│   └── chat-service/              # Socket.io realtime DM service
│       ├── package.json
│       └── index.ts               # port 3003
├── public/
│   ├── logo.svg                   # Twivter logo
│   └── uploads/                   # local upload dir (dev only)
├── package.json
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── Caddyfile                      # gateway config (dev)
└── .env
```

---

## Roadmap Fitur (18 Modul PRD)

| # | Modul | Status |
|---|---|---|
| 1 | Branding & Logo | ✅ |
| 2 | Landing Page | ✅ |
| 3 | Login | ✅ |
| 4 | Register | ✅ |
| 5 | Onboarding (6-step wizard) | ✅ |
| 6 | Home Feed — Desktop | ✅ |
| 7 | Home Feed — Mobile | ✅ |
| 8 | Explore & Trending | ✅ |
| 9 | Create Post (text + image) | ✅ |
| 10 | Post Detail & Comment | ✅ |
| 11 | Profile (+ edit + follow) | ✅ |
| 12 | Notifications | ✅ |
| 13 | Direct Message (realtime) | ✅ |
| 14 | Search | ✅ |
| 15 | Communities | ✅ |
| 16 | Bookmark / Saved | ✅ |
| 17 | Settings | ✅ |
| 18 | Admin Dashboard | ✅ |

---

**Twivter v1.0.0** — Built with Next.js 16, TypeScript, Prisma, and socket.io.
