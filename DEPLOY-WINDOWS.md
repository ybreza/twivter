# Twivter — Panduan Deploy untuk Windows 10

> Dokumen ini adalah **panduan khusus Windows 10** untuk menjalankan & deploy
> platform social media **Twivter** (Next.js 16 + Prisma + socket.io).
> Untuk panduan deploy umum (Vercel, Railway, PostgreSQL, dll), lihat
> [`DEPLOY.md`](./DEPLOY.md).

---

## Daftar Isi

1. [Apa Itu Twivter](#1-apa-itu-twivter)
2. [Spesifikasi & Arsitektur](#2-spesifikasi--arsitektur)
3. [Prasyarat Windows 10](#3-prasyarat-windows-10)
4. [Stage 1 — Ekstrak File ZIP](#stage-1--ekstrak-file-zip)
5. [Stage 2 — Install Node.js, Bun, dan Git](#stage-2--install-nodejs-bun-dan-git)
6. [Stage 3 — Konfigurasi Environment (.env)](#stage-3--konfigurasi-environment-env)
7. [Stage 4 — Install Dependencies](#stage-4--install-dependencies)
8. [Stage 5 — Setup Database SQLite](#stage-5--setup-database-sqlite)
9. [Stage 6 — Seed Data Demo](#stage-6--seed-data-demo)
10. [Stage 7 — Jalankan Aplikasi (Development)](#stage-7--jalankan-aplikasi-development)
11. [Stage 8 — Akses & Login Demo](#stage-8--akses--login-demo)
12. [Stage 9 — Build untuk Produksi (Lokal)](#stage-9--build-untuk-produksi-lokal)
13. [Stage 10 — Deploy ke Vercel dari Windows 10](#stage-10--deploy-ke-vercel-dari-windows-10)
14. [Stage 11 — Deploy Chat Service ke Railway](#stage-11--deploy-chat-service-ke-railway)
15. [Troubleshooting Windows 10](#troubleshooting-windows-10)
16. [FAQ](#faq)

---

## 1. Apa Itu Twivter

**Twivter** adalah platform microblogging bergaya Twitter/X yang dibangun
full-stack dengan:

- **Frontend + API** → Next.js 16 (App Router) + TypeScript + Tailwind CSS + shadcn/ui
- **Database** → Prisma ORM (SQLite untuk dev, PostgreSQL untuk produksi)
- **Realtime DM** → socket.io (mini-service terpisah)
- **Auth** → bcryptjs + JWT (jose) disimpan di httpOnly cookie

Fitur utama: registrasi/onboarding, posting (teks + gambar), like, comment,
repost, bookmark, follow/unfollow, explore, search, communities, notifications,
direct messages realtime, profile edit, admin dashboard (moderasi + verifikasi).

> **Catatan arsitektur:** aplikasi berjalan sebagai **single-page app di route `/`**
> dengan view-switching via Zustand. Semua "halaman" (home, explore, profile,
> messages, dll) di-render sebagai view components di dalam `src/app/page.tsx`.

---

## 2. Spesifikasi & Arsitektur

```
                 ┌──────────────────────────────────────┐
                 │           BROWSER (User)              │
                 │   Single-page app di route /          │
                 └──────────┬───────────────┬────────────┘
                            │ HTTP/REST     │ WebSocket
                            ▼               ▼
                 ┌─────────────────┐  ┌──────────────────┐
                 │  Next.js 16     │  │  Chat Service     │
                 │  (port 3000)    │  │  socket.io        │
                 │                 │  │  (port 3003)      │
                 │  - App Router   │  │  - Realtime DM    │
                 │  - API routes   │  │  - Typing ind.    │
                 │  - Image upload │  │  - Presence       │
                 └───────┬─────────┘  └────────┬──────────┘
                         │                     │
                         ▼                     │
                 ┌─────────────────┐           │
                 │  SQLite (dev)   │◄──────────┘
                 │  PostgreSQL     │
                 │  (produksi)     │
                 │  15 tabel        │
                 └─────────────────┘
```

**Dua service yang harus berjalan:**

| Service | Port | Cara jalankan |
|---|---|---|
| Next.js (frontend + API) | 3000 | `bun run dev` di root project |
| Chat Service (socket.io) | 3003 | `bun run dev` di `mini-services/chat-service/` |

---

## 3. Prasyarat Windows 10

### 3.1 Spesifikasi Minimum

| Komponen | Minimum | Rekomendasi |
|---|---|---|
| OS | Windows 10 (64-bit), build 1909+ | Windows 10/11 22H2+ |
| RAM | 4 GB | 8 GB+ |
| Disk kosong | 1 GB (tanpa node_modules) | 3 GB |
| PowerShell | 5.1 (bawaan Win10) | PowerShell 7+ atau Windows Terminal |

### 3.2 Software yang Harus Diinstall

| Software | Versi | Link Download | Keterangan |
|---|---|---|---|
| **Node.js** | ≥ 20.x LTS | https://nodejs.org/ | Pilih installer `.msi` (64-bit) |
| **Bun** | ≥ 1.1 | https://bun.sh/ | Package manager & runtime (utama) |
| **Git for Windows** | ≥ 2.40 | https://git-scm.com/download/win | Bundled dengan Git Bash |
| **Visual Studio Code** | latest (opsional) | https://code.visualstudio.com/ | Editor kode |
| **7-Zip** | latest (opsional) | https://www.7-zip.org/ | Untuk ekstrak ZIP |

> **Catatan:** Bun juga butuh **WSL 2** atau dijalankan native via installer
> PowerShell resmi. Untuk Windows 10, cara termudah adalah install lewat
> PowerShell (lihat Stage 2).

---

## Stage 1 — Ekstrak File ZIP

1. **Download** file `twivter.zip` ke komputer Windows 10 Anda (mis. ke folder `Downloads`).

2. **Klik kanan** pada `twivter.zip` → **Extract All...** (atau gunakan **7-Zip → Extract to "twivter\"**).

3. Pilih lokasi tujuan. **Disarankan:** path **pendek dan tanpa spasi**, contoh:
   ```
   C:\twivter
   ```
   ⚠️ **Hindari** path seperti `C:\Users\Nama Lengkap\Documents\My Projects\twivter`
   karena Windows punya batas path 260 karakter yang bisa menyebabkan error
   `ENAMETOOLONG` saat install dependencies.

4. Setelah ekstrak selesai, struktur folder akan terlihat seperti:
   ```
   C:\twivter\
   ├── .env.example
   ├── .gitignore
   ├── DEPLOY.md
   ├── DEPLOY-WINDOWS.md      ← file ini
   ├── package.json
   ├── next.config.ts
   ├── tsconfig.json
   ├── tailwind.config.ts
   ├── postcss.config.mjs
   ├── eslint.config.mjs
   ├── components.json
   ├── Caddyfile
   ├── prisma\
   │   └── schema.prisma
   ├── public\
   │   ├── logo.svg
   │   └── robots.txt
   ├── scripts\
   │   └── seed.ts
   ├── src\
   │   ├── app\
   │   ├── components\
   │   ├── hooks\
   │   ├── lib\
   │   └── stores\
   ├── mini-services\
   │   └── chat-service\
   │       ├── index.ts
   │       └── package.json
   ├── upload\
   │   └── PRD_Twivter.md
   └── db\
       └── (custom.db akan dibuat otomatis di sini)
   ```

---

## Stage 2 — Install Node.js, Bun, dan Git

### 2.1 Install Node.js

1. Buka https://nodejs.org/ di browser.
2. Download installer **Windows Installer (.msi)** versi **LTS** (≥ 20.x).
3. Jalankan installer → centang opsi:
   - ✅ **Add to PATH** (default sudah dicentang)
   - ✅ **Install tools for Native Modules** (opsional, tapi disarankan — akan install Python & C++ Build Tools yang dibutuhkan oleh beberapa dependency)
4. Klik **Install** → tunggu sampai selesai → **Finish**.

### 2.2 Install Bun

Buka **PowerShell** (cari "PowerShell" di Start Menu, klik kanan → **Run as administrator**), lalu jalankan:

```powershell
powershell -c "irm bun.sh/install.ps1 | iex"
```

Setelah selesai, **tutup dan buka kembali PowerShell**, lalu verifikasi:

```powershell
bun --version
# Output yang diharapkan: 1.1.x atau lebih baru
```

> Jika Bun tidak terdeteksi, tambahkan secara manual ke PATH:
> - Buka **System Properties → Environment Variables**
> - Edit **Path** di bagian User variables
> - Tambahkan: `%USERPROFILE%\.bun\bin`
> - Klik OK, tutup PowerShell, buka kembali.

### 2.3 Install Git for Windows

1. Buka https://git-scm.com/download/win.
2. Download dan jalankan installer.
3. Saat ditanya pilihan editor default, pilih **Use Visual Studio Code as Git's default editor** (atau editor favorit Anda).
4. Saat ditanya PATH adjustment, pilih: **Git from the command line and also from 3rd-party software** (default — direkomendasikan).
5. Selesaikan instalasi dengan opsi default lainnya.

Verifikasi:

```powershell
git --version
# Output: git version 2.40.x.windows.x atau lebih baru
```

### 2.4 (Opsional) Install Visual Studio Code

1. Download dari https://code.visualstudio.com/.
2. Installer default sudah mencentang **Add to PATH**.
3. Setelah install, buka VS Code → install ekstensi:
   - **ESLint** (Microsoft)
   - **Prisma** (Prisma)
   - **Tailwind CSS IntelliSense** (Tailwind Labs)
   - **TypeScript Vue Plugin (Volar)** — skip kalau tidak pakai Vue

---

## Stage 3 — Konfigurasi Environment (.env)

1. Buka **PowerShell** (tidak perlu admin), arahkan ke folder project:

   ```powershell
   cd C:\twivter
   ```

2. Salin file `.env.example` menjadi `.env`:

   ```powershell
   Copy-Item .env.example .env
   ```

   Atau via CMD:
   ```cmd
   copy .env.example .env
   ```

3. Buka file `.env` di VS Code atau Notepad:

   ```powershell
   code .env
   ```

4. **Untuk development lokal dengan SQLite, nilai default sudah cukup:**

   ```env
   DATABASE_URL="file:../db/custom.db"
   SESSION_SECRET="twivter-dev-secret-change-in-production-please"
   NODE_ENV="development"
   CHAT_SERVICE_PORT="3003"
   ```

   > Path `file:../db/custom.db` bersifat **relatif terhadap folder `prisma/`**,
   > jadi file database SQLite akan dibuat di `C:\twivter\db\custom.db`.

5. **(Disarankan) Generate SESSION_SECRET baru** untuk keamanan:

   ```powershell
   -join ((48..57) + (65..90) + (97..122) | Get-Random -Count 48 | % {[char]$_})
   ```

   Salin output string acak tersebut ke `.env`:

   ```env
   SESSION_SECRET="output-string-acak-dari-perintah-di-atas"
   ```

6. Simpan file `.env` (Ctrl+S di VS Code).

---

## Stage 4 — Install Dependencies

### 4.1 Install dependencies utama (Next.js app)

```powershell
cd C:\twivter
bun install
```

Tunggu proses selesai (biasanya 1-3 menit tergantung koneksi internet).
Jika berhasil, folder `node_modules\` akan terbuat dan `bun.lock` ter-update.

### 4.2 Install dependencies chat service

```powershell
cd C:\twivter\mini-services\chat-service
bun install
```

### 4.3 Verifikasi Prisma Client ter-generate

```powershell
cd C:\twivter
bun run db:generate
```

Output yang diharapkan:
```
✔ Generated Prisma Client (v6.x.x) to .\node_modules\@prisma\client in xxxms
```

---

## Stage 5 — Setup Database SQLite

Karena `.env` sudah set `DATABASE_URL="file:../db/custom.db"`, Prisma akan
membuat file `db\custom.db` otomatis. Jalankan:

```powershell
cd C:\twivter
bun run db:push
```

Output yang diharapkan:
```
🚀  Your database is now in sync with your Prisma schema. Run bun run db:generate to generate Prisma Client.
```

Verifikasi file database tercipta:

```powershell
Test-Path .\db\custom.db
# Output: True
```

---

## Stage 6 — Seed Data Demo

Seed script akan mengisi database dengan **8 user demo** (termasuk 1 admin),
13 post, follow graph, likes, reposts, comments, notifications, 4 communities,
3 conversations, 2 reports, dan 2 verification requests.

```powershell
cd C:\twivter
bun run seed
```

Output yang diharapkan:
```
🌱 Seeding Twivter database...
✅ Created 8 users (1 admin)
✅ Created 13 posts
✅ Created follow graph
✅ Created likes, reposts, comments
✅ Created notifications
✅ Created 4 communities
✅ Created 3 conversations
✅ Created 2 reports
✅ Created 2 verification requests
🎉 Seed complete!
```

**Akun demo yang tersedia:**

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

## Stage 7 — Jalankan Aplikasi (Development)

Aplikasi Twivter membutuhkan **DUA service** yang berjalan bersamaan:
1. **Next.js** (port 3000) — frontend + API
2. **Chat Service** (port 3003) — realtime DM

### Opsi A — Dua Terminal PowerShell (paling mudah)

**Terminal 1 — Next.js:**
```powershell
cd C:\twivter
bun run dev
```

Output:
```
▲ Next.js 16.1.x (Turbopack)
- Local:        http://localhost:3000
- Network:      http://<IP-lokal>:3000
✓ Ready in xxx ms
```

**Terminal 2 — Chat Service** (buka jendela PowerShell baru):
```powershell
cd C:\twivter\mini-services\chat-service
bun run dev
```

Output:
```
💬 Twivter chat service listening on http://localhost:3003
```

Buka browser ke **http://localhost:3000** → Twivter siap dipakai! 🎉

### Opsi B — Satu Terminal dengan Background Job

```powershell
# Terminal 1 — jalankan chat service di background
cd C:\twivter\mini-services\chat-service
Start-Process bun -ArgumentList "run","dev" -NoNewWindow

# Kembali ke root, jalankan Next.js
cd C:\twivter
bun run dev
```

Untuk menghentikan chat service: cari proses Bun di Task Manager atau jalankan
`Stop-Process -Name bun -Force`.

### Opsi C — Pakai Windows Terminal (split pane)

Jika sudah install [Windows Terminal](https://aka.ms/terminal):
1. Buka Windows Terminal.
2. Tab pertama: `cd C:\twivter; bun run dev`
3. Tekan **Alt+Shift+D** untuk split pane otomatis.
4. Di pane baru: `cd C:\twivter\mini-services\chat-service; bun run dev`

### Catatan Penting

- Jangan tutup kedua terminal selama aplikasi dipakai.
- Setiap kali mengubah `prisma/schema.prisma`, jalankan `bun run db:push` lagi.
- File `dev.log` akan terbentuk di root project — ini adalah log server Next.js.
- Hot reload aktif otomatis (Turbopack). Edit file `src/`, browser akan refresh sendiri.

---

## Stage 8 — Akses & Login Demo

1. Pastikan kedua service berjalan (lihat Stage 7).
2. Buka browser (Chrome / Edge / Firefox) ke:
   ```
   http://localhost:3000
   ```
3. Klik **"Log in"** di sidebar.
4. Login dengan akun demo:
   - **Email:** `yowanda@twivter.com`
   - **Password:** `password123`
5. Anda akan diarahkan ke halaman Home dengan timeline post.

### Fitur yang Bisa Dicoba

| Fitur | Cara |
|---|---|
| **Buat post** | Klik tombol "Post" di sidebar → tulis → "Post" |
| **Like post** | Klik ikon ❤️ di bawah post |
| **Comment** | Klik ikon 💬 → tulis komentar → kirim |
| **Repost** | Klik ikon 🔁 |
| **Bookmark** | Klik ikon 🔖 |
| **Follow user** | Buka profile user lain → klik "Follow" |
| **Explore** | Klik "Explore" di sidebar |
| **Search** | Klik "Search" → ketik kata kunci |
| **Communities** | Klik "Communities" → join komunitas |
| **Direct Messages** | Klik "Messages" → pilih conversation → kirim pesan realtime |
| **Notifications** | Klik "Notifications" (ikon 🔔) |
| **Profile** | Klik avatar → edit profile, lihat post sendiri |
| **Admin Dashboard** | Login sebagai admin → klik "Admin" (hanya muncul untuk role admin) |

---

## Stage 9 — Build untuk Produksi (Lokal)

Jika ingin menjalankan Twivter dalam mode produksi di Windows 10 (mis. untuk
testing sebelum deploy ke Vercel):

### 9.1 Set env ke production

Edit `.env`:
```env
NODE_ENV="production"
SESSION_SECRET="string-acak-yang-sudah-diganti"
```

### 9.2 Build Next.js

```powershell
cd C:\twivter
bun run build
```

Proses ini membutuhkan waktu 2-5 menit. Output standalone akan ada di:
```
C:\twivter\.next\standalone\
```

### 9.3 Jalankan server produksi

```powershell
cd C:\twivter
bun run start
```

Server akan listening di `http://localhost:3000`.

### 9.4 Jalankan chat service (mode produksi)

```powershell
cd C:\twivter\mini-services\chat-service
bun index.ts
```

> Catatan: untuk produksi sebenarnya, sebaiknya deploy ke Vercel + Railway
> (lihat Stage 10 & 11) atau setup Nginx + PM2 di VPS Windows Server.

---

## Stage 10 — Deploy ke Vercel dari Windows 10

### 10.1 Persiapan

1. Buat akun di https://vercel.com (bisa login pakai GitHub / GitLab / Bitbucket / Email).
2. Install Vercel CLI:

   ```powershell
   npm install -g vercel
   ```

3. Login:

   ```powershell
   vercel login
   ```

   Ikuti instruksi verifikasi email.

### 10.2 Setup PostgreSQL (Supabase / Neon)

Vercel tidak mendukung SQLite persisten, jadi wajib pakai PostgreSQL.

1. Daftar di https://supabase.com (gratis untuk project kecil).
2. Buat project baru → tunggu provisioning selesai.
3. Buka **Project Settings → Database → Connection string → URI**.
4. Salin connection string (format: `postgresql://postgres:password@db.xxxx.supabase.co:5432/postgres`).

### 10.3 Update schema Prisma untuk PostgreSQL

Edit `prisma/schema.prisma`:

```prisma
datasource db {
  provider = "postgresql"   // dari "sqlite"
  url      = env("DATABASE_URL")
}
```

### 10.4 Set environment variables di Vercel

Jalankan dari root project:

```powershell
vercel env add DATABASE_URL production
# Paste connection string PostgreSQL dari Supabase

vercel env add SESSION_SECRET production
# Paste secret acak (generate dengan perintah PowerShell di Stage 3)

vercel env add NODE_ENV production
# Ketik: production
```

### 10.5 Push schema ke PostgreSQL

```powershell
# Set DATABASE_URL lokal ke PostgreSQL Supabase sementara
$env:DATABASE_URL="postgresql://postgres:password@db.xxxx.supabase.co:5432/postgres"
bun run db:push
bun run seed  # optional, untuk isi data demo di prod
```

### 10.6 Deploy

```powershell
cd C:\twivter
vercel --prod
```

Vercel akan:
1. Detect project sebagai Next.js.
2. Install dependencies via Bun.
3. Build aplikasi.
4. Deploy ke URL `https://twivter-xxxx.vercel.app`.

### 10.7 Update URL frontend untuk chat service

Setelah deploy, catat URL production (mis. `https://twivter.vercel.app`).
Anda perlu update CORS / origin di chat service (lihat Stage 11).

---

## Stage 11 — Deploy Chat Service ke Railway

Chat service (socket.io) tidak bisa di-deploy ke Vercel (Vercel tidak support
WebSocket persistent). Gunakan **Railway** / **Render** / **Fly.io**.

### 11.1 Persiapan

1. Daftar di https://railway.app (login pakai GitHub).
2. Klik **New Project → Deploy from GitHub repo**.
   - Atau jika belum push ke GitHub, pakai **Deploy from local folder**.

### 11.2 Konfigurasi Railway

1. Pilih root folder: `mini-services/chat-service/`.
2. Railway akan auto-detect Bun project dari `package.json`.
3. Set **Start command**:
   ```
   bun index.ts
   ```
4. Set **Port** environment variable:
   ```
   PORT=3003
   ```
   (Railway otomatis expose port ke URL publik).

### 11.3 Update frontend untuk connect ke Railway

Edit `src/components/messages/use-chat-socket.ts` — ganti URL socket.io
dari localhost ke URL Railway:

```typescript
// Ganti dari:
const socket = io("/?XTransformPort=3003")

// Jadi (di production):
const CHAT_URL = process.env.NODE_ENV === "production"
  ? "https://twivter-chat.up.railway.app"
  : "/?XTransformPort=3003"
const socket = io(CHAT_URL)
```

### 11.4 Update CORS di chat service

Edit `mini-services/chat-service/index.ts` — tambahkan CORS untuk domain Vercel:

```typescript
const io = new Server(httpServer, {
  cors: {
    origin: process.env.NODE_ENV === "production"
      ? ["https://twivter.vercel.app"]
      : ["http://localhost:3000"],
    methods: ["GET", "POST"]
  }
})
```

### 11.5 Deploy

Klik **Deploy** di Railway dashboard. Tunggu sampai status **Active**.
Catat URL publik (mis. `https://twivter-chat.up.railway.app`).

---

## Troubleshooting Windows 10

### 1. Error: `ENAMETOOLONG` saat `bun install`

**Penyebab:** Path folder terlalu panjang (>260 karakter), umum di Windows.

**Solusi:**
1. Aktifkan **long path support** di Windows 10:
   - Buka **Registry Editor** (`regedit`).
   - Navigasi ke: `HKEY_LOCAL_MACHINE\SYSTEM\CurrentControlSet\Control\FileSystem`
   - Set `LongPathsEnabled` = `1` (DWORD).
   - Restart komputer.
2. Pindahkan project ke path lebih pendek, mis. `C:\twivter`.

### 2. Error: `bun: command not found` di PowerShell

**Penyebab:** Bun belum ditambahkan ke PATH.

**Solusi:**
1. Cek apakah folder `~\.bun\bin` ada:
   ```powershell
   Test-Path "$env:USERPROFILE\.bun\bin\bun.exe"
   ```
2. Jika ada, tambahkan ke PATH manual:
   ```powershell
   [Environment]::SetEnvironmentVariable("Path", "$env:Path;$env:USERPROFILE\.bun\bin", "User")
   ```
3. Tutup & buka PowerShell lagi.

### 3. Error: `Executing scripts is disabled on this system`

**Penyebab:** PowerShell Execution Policy membatasi script.

**Solusi:**
```powershell
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
```
Ketik `Y` untuk konfirmasi.

### 4. Error: `prisma: command not found`

**Penyebab:** Prisma CLI belum ter-generate.

**Solusi:**
```powershell
cd C:\twivter
bunx prisma --version   # cek
bun run db:generate     # generate client
```

### 5. Port 3000 sudah dipakai

**Penyebab:** Aplikasi lain (Skype, IIS, Docker, dll) sudah pakai port 3000.

**Solusi:** Cek siapa yang pakai:
```powershell
netstat -ano | findstr :3000
```
Lalu hentikan proses (PID ada di kolom terakhir):
```powershell
Stop-Process -Id <PID> -Force
```

Atau ganti port di `package.json`:
```json
"dev": "next dev -p 3001"
```

### 6. Database lock error (`SQLITE_BUSY`)

**Penyebab:** Ada proses lain (mis. SQLite viewer, atau instance Next.js lain) yang mengunci database.

**Solusi:**
1. Tutup semua terminal yang menjalankan `bun run dev`.
2. Hapus file lock: `db/custom.db-journal` jika ada.
3. Restart komputer jika perlu.
4. Jalankan ulang dari Stage 7.

### 7. Line ending error (`CRLF` vs `LF`)

**Penyebab:** Git mengubah line ending otomatis di Windows.

**Solusi:** Buat file `.gitattributes` di root project:
```
* text=auto eol=lf
*.ts text eol=lf
*.tsx text eol=lf
*.js text eol=lf
*.json text eol=lf
*.prisma text eol=lf
```

### 8. Chat service tidak connect (realtime DM tidak jalan)

**Gejala:** Pesan terkirim tapi tidak muncul realtime di penerima.

**Debug:**
1. Pastikan chat service berjalan:
   ```powershell
   curl http://localhost:3003
   ```
   Harus return HTML socket.io.
2. Buka DevTools (F12) → Console → cek error WebSocket.
3. Pastikan URL frontend benar: `/?XTransformPort=3003` (di dev) atau URL Railway (di prod).

### 9. Upload gambar gagal

**Gejala:** Upload avatar/cover/post media gagal dengan error 500.

**Penyebab:** Folder `public/uploads/` belum ada atau tidak writable.

**Solusi:**
```powershell
cd C:\twivter
New-Item -ItemType Directory -Force -Path public\uploads\avatars
New-Item -ItemType Directory -Force -Path public\uploads\covers
New-Item -ItemType Directory -Force -Path public\uploads\posts
```

### 10. Antivirus memblokir Bun / Node

**Gejala:** `bun install` sangat lambat atau error "Access denied".

**Solusi:** Tambahkan folder project dan `~\.bun\` ke **exclusion list** antivirus:
- Windows Defender: **Settings → Update & Security → Windows Security → Virus & threat protection → Exclusions**.
- Antivirus lain (Avast, Kaspersky, dll): cek dokumentasi masing-masing.

---

## FAQ

### Q: Bisakah Twivter dijalankan tanpa Bun (pakai npm/yarn saja)?

**A:** Bisa, dengan catatan:
- Ganti semua perintah `bun install` → `npm install` atau `yarn install`.
- Ganti `bun run dev` → `npm run dev` atau `yarn dev`.
- Untuk seed script, ganti `bun run scripts/seed.ts` → `npx tsx scripts/seed.ts` (install dulu: `npm i -D tsx`).

Namun **Bun direkomendasikan** karena lebih cepat 10-30x saat install dependencies.

### Q: Apakah harus selalu menjalankan dua service (Next.js + chat)?

**A:** Untuk mengakses semua fitur (termasuk realtime DM), **ya**.
Tapi jika hanya ingin pakai fitur non-realtime (posting, like, follow, dll),
cukup jalankan Next.js saja. Chat service hanya untuk DM.

### Q: Bisakah deploy ke hosting Windows biasa (shared hosting cPanel/Plesk)?

**A:** **Tidak disarankan.** Twivter butuh:
- Node.js 20+ runtime
- WebSocket support (untuk chat service)
- Long-running process (chat service harus selalu aktif)

Shared hosting umumnya hanya support PHP + MySQL. Gunakan **VPS** (DigitalOcean,
Hetzner, Vultr) atau **PaaS** (Vercel + Railway) seperti dijelaskan di Stage 10 & 11.

### Q: Bagaimana cara reset database dari awal?

**A:**
```powershell
cd C:\twivter
Remove-Item .\db\custom.db -Force -ErrorAction SilentlyContinue
Remove-Item .\db\custom.db-journal -Force -ErrorAction SilentlyContinue
bun run db:push
bun run seed
```

### Q: Apakah data demo bisa dihapus setelah deploy produksi?

**A:** Bisa. Setelah deploy dan setup PostgreSQL, jalankan:
```powershell
$env:DATABASE_URL="postgresql://..."   # connection string prod
bunx prisma db push --accept-data-loss   # reset schema
# JANGAN jalankan `bun run seed` — biarkan database kosong untuk user real.
```

### Q: Bagaimana cara ganti nama domain dari `twivter.vercel.app` ke domain sendiri?

**A:**
1. Beli domain (mis. di Niagahoster, Namecheap, Cloudflare).
2. Di Vercel dashboard: **Settings → Domains → Add** → masukkan domain.
3. Tambahkan record DNS di provider domain:
   - `A` record: `@` → `76.76.21.21`
   - `CNAME` record: `www` → `cname.vercel-dns.com`
4. Tunggu propagasi DNS (5 menit - 24 jam).

### Q: Apakah Twivter support dark mode?

**A:** Ya, dark mode sudah aktif lewat `next-themes`. Klik ikon tema (🌙/☀️) di header untuk toggle.

### Q: Bagaimana cara backup database SQLite?

**A:**
```powershell
Copy-Item .\db\custom.db .\db\custom-backup-$(Get-Date -Format "yyyyMMdd").db
```

Untuk restore:
```powershell
Copy-Item .\db\custom-backup-20250101.db .\db\custom.db -Force
```

---

## Ringkasan Cepat (Quick Start)

```powershell
# 1. Ekstrak twivter.zip ke C:\twivter
cd C:\twivter

# 2. Copy .env.example ke .env
Copy-Item .env.example .env

# 3. Install dependencies (utama + chat service)
bun install
cd mini-services\chat-service; bun install; cd ..\..

# 4. Setup database + seed
bun run db:push
bun run seed

# 5. Jalankan DUA service di DUA terminal berbeda
#    Terminal 1:
bun run dev

#    Terminal 2:
cd mini-services\chat-service; bun run dev

# 6. Buka browser ke http://localhost:3000
# 7. Login: yowanda@twivter.com / password123
```

---

**Selamat menggunakan Twivter! 🐦**

Jika menemukan bug atau butuh bantuan, cek:
- [`DEPLOY.md`](./DEPLOY.md) — panduan deploy umum (Linux/macOS + Vercel + Railway)
- [`worklog.md`](./worklog.md) — log pengembangan lengkap
- [`upload/PRD_Twivter.md`](./upload/PRD_Twivter.md) — Product Requirements Document
