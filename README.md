# Twivter 🐦

Platform microblogging bergaya Twitter/X yang dibangun full-stack dengan
**Next.js 16** (App Router), **TypeScript**, **Prisma** (SQLite/PostgreSQL),
dan **socket.io** untuk realtime Direct Messages.

> **Quick links:**
> - 📗 [**`DEPLOY-WINDOWS.md`**](./DEPLOY-WINDOWS.md) — Panduan deploy untuk **Windows 10** (utama untuk Anda)
> - 📘 [**`DEPLOY.md`**](./DEPLOY.md) — Panduan deploy umum (Linux/macOS + Vercel + Railway)
> - 📄 [**`upload/PRD_Twivter.md`**](./upload/PRD_Twivter.md) — Product Requirements Document
> - 📝 [**`worklog.md`**](./worklog.md) — Log pengembangan lengkap

---

## Teknologi

| Komponen | Teknologi |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack) |
| Bahasa | TypeScript 5 |
| Styling | Tailwind CSS 4 + shadcn/ui (New York) |
| Database | Prisma ORM (SQLite dev / PostgreSQL prod) |
| Auth | bcryptjs + jose JWT (httpOnly cookie) |
| Realtime | socket.io (mini-service terpisah) |
| State | Zustand (client) + TanStack Query (server) |
| Runtime | Bun (recommended) atau Node.js ≥ 20 |

---

## Quick Start (Windows 10)

```powershell
# 1. Ekstrak twivter.zip ke C:\twivter
cd C:\twivter

# 2. Copy .env.example ke .env
Copy-Item .env.example .env

# 3. Install dependencies (utama + chat service)
bun install
cd mini-services\chat-service; bun install; cd ..\..

# 4. Setup database + seed (skip jika db\custom.db sudah ada & ter-seed)
bun run db:push
bun run seed

# 5. Jalankan DUA service di DUA terminal berbeda
#    Terminal 1 (Next.js):
bun run dev

#    Terminal 2 (chat service):
cd mini-services\chat-service; bun run dev

# 6. Buka http://localhost:3000 di browser
# 7. Login demo: yowanda@twivter.com / password123
```

📖 **Panduan lengkap step-by-step:** [`DEPLOY-WINDOWS.md`](./DEPLOY-WINDOWS.md)

---

## Struktur Project

```
twivter/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── page.tsx            # Single-page app (view-switching)
│   │   ├── layout.tsx          # Root layout (Inter font + Providers)
│   │   ├── globals.css         # Tailwind + tema Twivter
│   │   └── api/                # REST API routes
│   │       ├── auth/           # login, register, logout, me
│   │       ├── posts/          # CRUD posts + like/comment/repost/bookmark
│   │       ├── profiles/       # profile + follow
│   │       ├── conversations/  # DM list + messages
│   │       ├── notifications/  # notifications list + read
│   │       ├── communities/    # list + detail + join
│   │       ├── admin/          # admin dashboard (users, reports, verifications)
│   │       ├── explore/        # trending + suggestions
│   │       ├── search/         # full-text search
│   │       ├── onboarding/     # post-register onboarding
│   │       ├── upload/         # image upload (avatar/cover/post)
│   │       └── reports/        # submit report
│   ├── components/             # React components
│   │   ├── ui/                 # shadcn/ui component set
│   │   ├── layout/             # app shell + sidebar
│   │   ├── post/               # post card + composer
│   │   ├── messages/           # DM UI + socket hook
│   │   ├── profile/            # edit profile dialog
│   │   └── views/              # view components (home, explore, dll)
│   ├── lib/                    # utilities
│   │   ├── auth.ts             # bcrypt + JWT session
│   │   ├── db.ts               # Prisma client singleton
│   │   ├── api.ts              # fetch helper
│   │   ├── types.ts            # shared types
│   │   ├── serialize.ts        # Prisma → JSON safe
│   │   ├── hooks.ts            # generic React Query hooks
│   │   └── utils.ts            # cn() + misc
│   ├── hooks/                  # custom hooks
│   └── stores/                 # Zustand stores
│       └── app-store.ts        # auth + view router + theme
├── prisma/
│   └── schema.prisma           # 15 models: User, Post, Follow, dll
├── scripts/
│   └── seed.ts                 # demo data seeder
├── mini-services/
│   └── chat-service/           # socket.io mini-service (port 3003)
│       ├── index.ts
│       └── package.json
├── public/                     # static assets
├── upload/
│   └── PRD_Twivter.md          # original PRD
├── db/
│   └── custom.db               # SQLite database (pre-seeded)
├── .env.example                # environment template
├── package.json
├── next.config.ts
├── tsconfig.json
├── tailwind.config.ts
├── components.json             # shadcn/ui config
├── Caddyfile                   # dev gateway (opsional, untuk sandbox)
├── DEPLOY.md                   # general deploy guide
└── DEPLOY-WINDOWS.md           # Windows 10 deploy guide ← LIHAT INI
```

---

## Fitur

- ✅ **Auth**: register, login, logout, session via httpOnly cookie
- ✅ **Onboarding**: setup username, avatar, bio, minat setelah register
- ✅ **Posting**: text + multiple images, reply, quote
- ✅ **Interaksi**: like, comment, repost, bookmark
- ✅ **Sosial**: follow/unfollow, followers/following list
- ✅ **Discovery**: explore (trending), search (full-text), suggestions
- ✅ **Communities**: list, detail, join/leave
- ✅ **Notifications**: like, comment, follow, mention, mark as read
- ✅ **Direct Messages**: realtime via socket.io, typing indicator, read receipt
- ✅ **Profile**: edit profile (avatar, cover, bio, location, website)
- ✅ **Admin**: dashboard untuk moderasi user, reports, verifications
- ✅ **Dark Mode**: toggle via next-themes
- ✅ **Responsive**: mobile-first, sidebar collapsible

---

## Akun Demo

| Email | Password | Role |
|---|---|---|
| `yowanda@twivter.com` | `password123` | Admin |
| `budi@twivter.com` | `password123` | User |
| `citra@twivter.com` | `password123` | User |
| `dewi@twivter.com` | `password123` | User |
| `eka@twivter.com` | `password123` | User |
| `fajar@twivter.com` | `password123` | User |
| `gita@twivter.com` | `password123` | User |
| `hadi@twivter.com` | `password123` | User |

---

## Lisensi

MIT — bebas dipakai, dimodifikasi, dan didistribusikan ulang.
