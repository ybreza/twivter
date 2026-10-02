# Twivter

A Twitter/X-style social platform, running entirely on Cloudflare.

| Concern | Choice |
| --- | --- |
| Runtime | Cloudflare Workers (Next.js 16 via OpenNext) |
| Database | Cloudflare D1 (SQLite-compatible) |
| Media storage | Cloudflare R2 |
| Realtime chat | Cloudflare Durable Objects + WebSocket Hibernation |
| Auth | bcrypt password hashing + server-side sessions in D1, httpOnly cookie |

There is no separate chat service, no object-storage provider, and no external
database. `npm run deploy` produces one Worker.

## Features

- Auth: register, login, logout, session revocation, onboarding wizard
- Feed: home (following), explore (all), bookmarks, cursor pagination
- Posts: text up to 280 chars, up to 4 images, replies, quote posts
- Interactions: like, repost, bookmark, reply — with counts and viewer flags
- Profiles: cover/avatar, bio, website, location, interests, tabs, follow graph
- Messaging: 1:1 and group DMs, live delivery, typing indicators, unread badges
- Communities: browse, create, join/leave, member roles, owner management
- Moderation: reports against users and posts, verification requests, admin
  dashboard with 7-day growth chart
- Settings: account, theme (light/dark/system), interests, notification and
  privacy preferences
- Search across posts, users and communities; trending hashtags
- Installable: add-to-home-screen on Android and iOS, with an offline shell

## Installing on a phone

The app is a PWA, so it installs from the browser — no app store, no APK/IPA.

**Android (Chrome):** open the site, then the ⋮ menu → *Install app* / *Add to
Home screen*. Chrome only offers this once the service worker has registered, so
give the page a moment on first load.

**iOS (Safari):** open the site, then Share → *Add to Home Screen*. Safari
ignores web app manifests, so this relies on the `apple-touch-icon` and
`apple-mobile-web-app-capable` tags in `src/app/layout.tsx`, and it must be
Safari rather than Chrome on iOS.

Icons live in `public/icons/` and are generated rather than hand-drawn — run
`node scripts/gen-icons.mjs` after changing the brand colours or the mark.
`public/sw.js` precaches the app shell for offline launches and deliberately
never caches `/api/*`, so a stale timeline or session can never be shown.

## Quick start

```bash
bun install
cp .dev.vars.example .dev.vars      # then fill in SESSION_SECRET
bunx wrangler login                 # once

bun run db:local                    # create the local D1 schema
bun run db:seed                     # load demo data
bun run dev                         # http://localhost:3000
bun run smoke                       # end-to-end API test suite (95 checks)
```

> Durable Objects are not loaded by `next dev`, so the chat WebSocket cannot
> connect locally. The client falls back to polling every 5 seconds while the
> socket is down, so messaging still works. Use `bun run preview` to exercise
> realtime in the real Workers runtime.

Demo accounts (all use password `password123`):

| Email | Role |
| --- | --- |
| `yowanda@twivter.com` | admin |
| `sara@twivter.com` | user |
| `bagus@twivter.com`, `maya@twivter.com`, `rizki@twivter.com`, `dewi@twivter.com`, `arif@twivter.com`, `nina@twivter.com` | user |

## Deploying

```bash
bunx wrangler d1 migrations apply twivter-db --remote
bunx wrangler secret put SESSION_SECRET
bunx wrangler secret put CHAT_INTERNAL_SECRET
bun run deploy
```

See [docs/DEPLOY.md](docs/DEPLOY.md) for the full walkthrough and
[docs/DATA-LAYER.md](docs/DATA-LAYER.md) for the database contract every route
follows.

## Project layout

```
migrations/            D1 schema migrations
scripts/seed.mjs       demo data, applied via `wrangler d1 execute --file`
scripts/gen-icons.mjs  generates the PWA icons in public/icons
public/icons/          PWA icons (generated)
public/sw.js           service worker: offline shell, caches no API responses
src/cloudflare/        Durable Object (ChatUser)
src/lib/               db client, auth, validation, storage, DTO builders
src/lib/data/          repositories: posts, users, conversations, communities…
src/app/manifest.ts    web app manifest
src/app/api/           route handlers
src/components/        SPA views (the app is a single `/` route)
worker.ts              Worker entry: OpenNext handler + Durable Object
```

## Notable implementation details

**Sortable ids.** Primary keys are 9 base36 characters of millisecond timestamp
plus 12 random characters (`src/lib/ids.ts`). Because ids sort chronologically,
every paginated query uses a plain keyset cursor (`WHERE id < ? ORDER BY id`).
Paginating on `createdAt` — what the previous version did — silently skipped or
duplicated rows whenever two records shared a timestamp.

**Fixed query counts.** A page of posts costs six queries regardless of page
size: posts+author, media, all four counters in one `UNION ALL`, and three
viewer-flag lookups. The previous serializer ran seven queries per post, so a
20-post feed cost around 140 round-trips.

**Client-side image processing.** `sharp` is a native module and cannot run on
Workers. Images are decoded, downscaled and re-encoded to WebP in the browser
(`src/lib/image.ts`) before being written to R2, so the Worker only validates
and stores bytes.

**Durable Objects over socket.io.** Each user has one `ChatUser` object holding
their sockets, using the WebSocket Hibernation API so idle connections cost
nothing. Messages are persisted over HTTP and then pushed by the server, so a
client can never spoof delivery and a dropped socket cannot lose a message.