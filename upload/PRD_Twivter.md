# Product Requirements Document (PRD)
# Twivter — Social Media Platform

**Versi:** 1.0
**Status:** Development (Step 4–7 dari roadmap)
**Stack:** Next.js 16 + TypeScript + Tailwind CSS + Supabase

---

## 1. Ringkasan Produk

Twivter adalah platform social media bergaya Twitter/X yang dibangun full-stack dengan Next.js (App Router) di sisi frontend dan Supabase (Auth, PostgreSQL, Storage, Realtime) di sisi backend, di-deploy ke Vercel. Target akhir: website yang bisa dijalankan penuh di `twivter.com`.

---

## 2. Tujuan Produk

- Membangun social platform yang punya alur lengkap: registrasi → onboarding → posting → interaksi sosial (like, comment, repost, follow) → discovery (explore, search, communities) → komunikasi (DM) → moderasi (admin dashboard).
- Arsitektur harus scalable — contoh: followers/following count dihitung lewat database function/RPC, bukan dihitung manual di frontend, supaya tetap jalan dari 10 followers sampai 10 juta followers.
- Pengembangan dilakukan bertahap per step, tidak membangun semua 15+ halaman sekaligus.

---

## 3. Tech Stack

### Frontend
| Komponen | Pilihan |
|---|---|
| Framework | Next.js 16 (App Router) |
| Bahasa | TypeScript |
| Styling | Tailwind CSS |
| Font | Inter |
| Responsive | Desktop & Mobile |
| Hosting | Vercel |

### Backend
| Komponen | Pilihan |
|---|---|
| BaaS | Supabase |
| Database | PostgreSQL |
| Auth | Supabase Auth (`@supabase/ssr`, cookie-based session) |
| Storage | Supabase Storage (avatar, cover) |
| Realtime | Supabase Realtime |

### Setup Awal
```bash
npx create-next-app@latest twivter
```
Opsi saat setup: TypeScript ✔, ESLint ✔, Tailwind CSS ✔, `src/` directory ✔, App Router ✔, Turbopack ✔, Import alias ✔.

```bash
npm install @supabase/supabase-js @supabase/ssr
```

`.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL=YOUR_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR_SUPABASE_PUBLISHABLE_KEY
```

> ⚠️ **Security note:** `service_role` key tidak boleh pernah dimasukkan ke frontend.

---

## 4. Core System Architecture

```
USER
│
├── Profile
│    ├── Followers
│    └── Following
│
├── POST
│    ├── Text
│    ├── Image
│    ├── Video
│    ├── Like
│    ├── Comment
│    ├── Repost
│    └── Bookmark
│
├── EXPLORE
│    ├── Search
│    ├── Trending
│    └── Communities
│
├── NOTIFICATION
│
└── MESSAGE
     ├── Private Chat
     └── Group Chat
```

---

## 5. Struktur Project (Folder Convention)

```
src/
├── app/
│   ├── (auth)/
│   │   ├── login/
│   │   └── register/
│   │
│   ├── (main)/
│   │   ├── home/
│   │   ├── explore/
│   │   ├── notifications/
│   │   ├── messages/
│   │   ├── bookmarks/
│   │   └── communities/
│   │
│   ├── profile/
│   │   └── [username]/
│   │
│   ├── settings/
│   ├── onboarding/
│   ├── admin/
│   │
│   ├── layout.tsx
│   └── page.tsx
│
├── components/
│   ├── ui/
│   ├── layout/
│   ├── post/
│   ├── profile/
│   └── navigation/
│
├── lib/
│   └── supabase/
│       ├── client.ts
│       └── server.ts
```

---

## 6. Design System

| Token | Nilai |
|---|---|
| Primary | Twivter Blue |
| Secondary | Purple |
| Background | White |
| Dark | Navy |
| Text | Slate |
| Border | Light Gray |
| Radius | 14px |
| Font | Inter |

**Theme mode:** ☀ Light / 🌙 Dark / ⚙ System

### Layout — Desktop
```
┌───────────────────────────────────────────────────────┐
│ TWIVTER                         Search   🔔   Avatar  │
├──────────────┬────────────────────────┬───────────────┤
│              │                        │               │
│ 🏠 Home      │                        │ Trending      │
│ 🔎 Explore   │       FEED             │               │
│ 🔔 Notif     │                        │ #Teknologi    │
│ 💬 Messages  │                        │ #AI           │
│ 🔖 Saved     │                        │ #Bisnis       │
│ 👤 Profile   │                        │               │
│ ➕ Post      │                        │               │
└──────────────┴────────────────────────┴───────────────┘
```

### Layout — Mobile
```
┌─────────────────────────┐
│ TWIVTER             🔔  │
├─────────────────────────┤
│       FEED              │
│       POST               │
│       POST               │
├─────────────────────────┤
│ 🏠  🔎  ➕  🔔  👤     │
└─────────────────────────┘
```

---

## 7. Roadmap & Urutan Fitur

Urutan pengembangan resmi (18 modul):

1. Branding & Logo
2. Landing Page
3. Login
4. Register
5. Onboarding
6. Home Feed — Desktop
7. Home Feed — Mobile
8. Explore & Trending
9. Create Post
10. Post Detail & Comment
11. Profile
12. Notifications
13. Direct Message
14. Search
15. Communities
16. Bookmark / Saved
17. Settings
18. Admin Dashboard

### Status per Step Teknis

| Step | Nama | Status |
|---|---|---|
| 4 | Setup project Next.js + Supabase, 4 halaman inti (`/`, `/login`, `/register`, `/home`) | ✅ Selesai |
| 5 | Authentication (Register, Login, Logout, Session, Protected route, Redirect, Forgot password, Email verification, Auto-create profile, Onboarding) | ✅ Selesai (sebagian: Register, Login, Protected Home, Logout — sudah ada kode) |
| 6 | Profile System (API profile, halaman profile, unique username, edit profile, upload avatar/cover, follow system) | ✅ Selesai |
| 7 | Create Post (Composer, upload media, tampil di Home Feed) | 🔄 Sedang dikerjakan |
| 8 | Feed | ⏳ Belum |
| 9 | Like / Comment / Repost | ⏳ Belum |
| 10–18 | Post Detail, Notifications, DM, Search, Communities, Bookmark, Settings, Admin Dashboard | ⏳ Belum dibahas rinci |

---

## 8. User Flow Utama

```
twivter.com
     │
     ▼
  LANDING
     │
 ┌───┴────┐
 ▼        ▼
REGISTER  LOGIN
 │        │
 ▼        ▼
ONBOARDING  AUTH CHECK
 │        │
 └───┬────┘
     ▼
   HOME
```

### Onboarding Flow (User Baru)
```
REGISTER
  ↓
Pilih username
  ↓
Nama
  ↓
Foto profil
  ↓
Bio
  ↓
Pilih minat
  ↓
Follow beberapa akun
  ↓
HOME
```
Tujuan: feed pertama user tidak kosong saat pertama kali masuk Home.

---

## 9. Database Schema (Rencana Tabel)

Tabel yang direncanakan secara eksplisit:
`User (profiles)`, `Post`, `Follow`, `Like`, `Comment`, `Repost`, `Notification`, `Message`, `Community`, `Report`, `Verification`, `Admin`.

### Detail field yang sudah ditentukan:

**`profiles`**
| Field | Keterangan |
|---|---|
| id | terhubung ke `auth.users` |
| username | unik, case-insensitive |
| display_name | nama tampilan |
| bio | deskripsi profil |
| website | link eksternal |
| avatar_url | hasil upload Supabase Storage |
| cover_url | hasil upload Supabase Storage |
| followers_count | dihitung via DB function/RPC |
| following_count | dihitung via DB function/RPC |
| posts_count | dihitung via DB function/RPC |

Constraint username unik:
```sql
create unique index if not exists profiles_username_unique
on public.profiles (lower(username));
```

**`follows`**
| Field | Keterangan |
|---|---|
| follower_id | user yang melakukan follow |
| following_id | user yang di-follow |

**`posts` / `post_media`**
- `posts`: menyimpan konten post (text, poll, reply, quote post relation)
- `post_media`: menyimpan lampiran foto/video/GIF per post

> Catatan: skema lengkap untuk `Like`, `Comment`, `Repost`, `Notification`, `Message`, `Community`, `Report`, `Verification`, `Admin` masih di tahap perencanaan nama tabel — struktur kolom detail belum dibahas dalam percakapan ini.

---

## 10. Functional Requirements per Modul

### 10.1 Landing Page (`/`)
Entry point publik sebelum login, mengarahkan user ke Register atau Login.

### 10.2 Register (`/register`)
- Form: email, password, username, display name.
- Implementasi: `supabase.auth.signUp()` dengan metadata `username` dan `display_name`.
- Setelah sukses → lanjut ke Onboarding.

### 10.3 Login (`/login`)
- Form: email, password.
- Setelah sukses → redirect ke `/home`, `router.refresh()`.

### 10.4 Onboarding
- Alur: pilih username → nama → foto profil → bio → pilih minat → follow beberapa akun → Home.

### 10.5 Home Feed — Desktop
- 3 kolom: sidebar navigasi kiri (Home, Explore, Notif, Messages, Saved, Profile, tombol Post), kolom tengah Feed, sidebar kanan Trending.
- Route dilindungi: jika tidak ada session → redirect ke `/login`.

### 10.6 Home Feed — Mobile
- Header dengan judul & ikon notifikasi.
- Feed vertikal berisi kartu post.
- Bottom navigation: Home, Explore, Post, Notif, Profile.

### 10.7 Explore & Trending
- Bagian dari modul EXPLORE: Search, Trending, Communities.
- Detail UI belum dibahas.

### 10.8 Create Post
- Composer: input "What is happening?", aksi tambahan (emoji, foto, video, GIF, lokasi), tombol POST.
- Tipe konten yang didukung: Text, Foto, Video, GIF, Poll, Reply, Quote post.
- Alur data:
```
CREATE POST
   ↓
 posts
   ↓
 post_media
   ↓
 HOME FEED
   ↓
LIKE · COMMENT · REPOST · BOOKMARK · SHARE
```

### 10.9 Post Detail & Comment
Belum dibahas rinci — direncanakan setelah Create Post & Feed selesai.

### 10.10 Profile (`/profile/[username]`)
- Data ditampilkan: Avatar, Cover, Display Name, Username, Bio, Website, Followers, Following, jumlah post, tombol Follow, tombol Edit Profile, tab Posts / Replies / Media / Likes, badge Verification.
- Wireframe:
```
┌─────────────────────────────────────┐
│          COVER IMAGE                │
│        ┌──────────┐                 │
│        │  AVATAR  │                 │
│        └──────────┘                 │
│  Yowanda Riski              Edit    │
│  @yowanda                           │
│  Bio pengguna...                    │
│  120 Following   1.2K Followers     │
│  Posts Replies Media Likes          │
├─────────────────────────────────────┤
│              POST                   │
└─────────────────────────────────────┘
```
- API: `GET /api/profile` → return data profil user yang sedang login (401 jika unauthorized).
- Page: fetch profile berdasarkan `username`, `notFound()` jika tidak ditemukan.

### 10.11 Edit Profile (`/profile/edit`)
- Field yang bisa diubah: `display_name`, `username`, `bio`, `website`, `avatar_url`, `cover_url`.
- Wireframe:
```
┌──────────────────────────────┐
│ Edit Profile             X   │
├──────────────────────────────┤
│       [ Change Avatar ]      │
│ Name    [ Yowanda Riski   ]  │
│ Username[ yowanda         ]  │
│ Bio     [.................]  │
│ Website [.................]  │
│             [ Save ]         │
└──────────────────────────────┘
```

### 10.12 Upload Avatar & Cover
| Jenis | Format | Ukuran Maks |
|---|---|---|
| Avatar | JPEG, PNG, WEBP | 5 MB |
| Cover | JPEG, PNG, WEBP | 10 MB |

Alur upload:
```
User pilih foto → Compress → Upload ke Supabase Storage
→ Dapat Public URL → update profiles.avatar_url/cover_url
→ Profile langsung berubah
```
Bucket Storage yang digunakan: `avatars`, `covers`.

### 10.13 Follow System
- Aksi follow membuat baris baru di tabel `follows` (`follower_id`, `following_id`).
- Efek: followers count target +1, following count pelaku +1.
- Toggle tombol: `Follow` ↔ `Following`.
- Count wajib dihitung lewat database function/RPC, bukan dihitung manual di client, agar tetap scalable.

### 10.14 Notifications
Bagian dari core system (`NOTIFICATION`) — belum dibahas rinci implementasinya.

### 10.15 Direct Message
Bagian dari core system (`MESSAGE`), terdiri dari Private Chat dan Group Chat — belum dibahas rinci implementasinya.

### 10.16 Search
Bagian dari modul EXPLORE — belum dibahas rinci.

### 10.17 Communities
Bagian dari modul EXPLORE — belum dibahas rinci.

### 10.18 Bookmark / Saved
Muncul sebagai item sidebar navigasi dan sebagai salah satu aksi post (bersama Like, Comment, Repost, Share) — belum ada halaman terpisah yang dibahas.

### 10.19 Settings
Route `/settings` sudah dialokasikan di struktur folder — belum dibahas rinci.

### 10.20 Admin Dashboard
Route `/admin` sudah dialokasikan di struktur folder — belum dibahas rinci. Tabel terkait: `Report`, `Verification`, `Admin`.

---

## 11. Authentication — Detail Teknis (Step 5)

Pola: `@supabase/ssr` + cookie-based session (bukan localStorage token).

**Browser client** — `src/lib/supabase/client.ts`
```typescript
import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  );
}
```

**Server client** — `src/lib/supabase/server.ts`
```typescript
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // Server Component tidak selalu dapat menulis cookie.
          }
        },
      },
    }
  );
}
```

**Protected route** — `src/app/(main)/home/page.tsx`
```typescript
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function HomePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <h1 className="text-2xl font-bold">Welcome to Twivter 👋</h1>
      <p className="mt-2 text-slate-500">Login sebagai {user.email}</p>
    </main>
  );
}
```

**Logout component** — `src/components/auth/logout-button.tsx`
```typescript
"use client";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export default function LogoutButton() {
  const supabase = createClient();
  const router = useRouter();

  async function logout() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <button onClick={logout} className="rounded-xl border px-4 py-2 text-sm font-medium">
      Logout
    </button>
  );
}
```

### Cakupan fitur auth yang direncanakan
Register, Login, Logout, Session, Protected route, Redirect, Forgot password, Email verification, Auto-create profile, Onboarding.

> Forgot password, email verification, dan auto-create profile belum diimplementasikan kodenya di percakapan ini — masih di daftar rencana Step 5.

### Alur Auth Setelah Step 5
```
TWIVTER
   │
┌──┴──┐
▼     ▼
REGISTER  LOGIN
│         │
▼         ▼
SUPABASE AUTH  SUPABASE AUTH
│         │
▼         ▼
PROFILE   SESSION
│         │
▼         ▼
ONBOARDING ──→ HOME
   │
   ▼
LOGOUT
```

---

## 12. Non-Functional Requirements

- **Keamanan:** `service_role` key Supabase tidak boleh terekspos di frontend; hanya publishable key yang dipakai di client/browser.
- **Konsistensi data:** username harus unik secara case-insensitive di level database (unique index), tidak cukup validasi di frontend.
- **Skalabilitas:** metrik agregat (followers/following/posts count) dihitung lewat RPC/database function, bukan query manual di client, supaya performa tetap stabil di skala besar.
- **Responsif:** seluruh halaman harus punya layout Desktop dan Mobile terpisah (lihat Section 6).

---

## 13. Belum Dibahas / Out of Scope Percakapan Ini

Poin-poin berikut ada di roadmap 18 modul tapi detail requirement/UI-nya belum dibahas dalam percakapan ini, sehingga belum bisa dituangkan sebagai spesifikasi teknis:

- Branding & Logo (identitas visual, logo mark)
- Explore & Trending (algoritma trending, UI)
- Post Detail & Comment (thread, nested reply)
- Notifications (jenis notifikasi, realtime delivery)
- Direct Message (skema tabel chat, realtime, group chat)
- Search (index pencarian, filter)
- Communities (struktur, membership, moderasi)
- Settings (kategori pengaturan apa saja)
- Admin Dashboard (fitur moderasi, akses role)
- Skema kolom detail untuk tabel: `Like`, `Comment`, `Repost`, `Notification`, `Message`, `Community`, `Report`, `Verification`, `Admin`
- Forgot password & email verification flow (kode belum ditulis)
- Auto-create profile saat signup (trigger/function belum ditulis)

---

## 14. Ringkasan Next Step

Sesuai percakapan, tahap yang sedang berjalan adalah **Step 7 — Create Post**: membangun composer, upload media, dan menampilkan post pertama di Home Feed. Setelah itu berlanjut ke Step 8 (Feed) dan Step 9 (Like/Comment/Repost).
