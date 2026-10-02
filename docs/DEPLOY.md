# Deploying Twivter to Cloudflare

Everything runs on one Worker: Next.js via OpenNext, D1 for data, R2 for media,
Durable Objects for realtime chat.

## Prerequisites

- A Cloudflare account
- Node.js 20+ or [Bun](https://bun.sh)
- A Wrangler login: `npx wrangler login`

## 1. Install

```bash
bun install
```

## 2. Create the Cloudflare resources

The checked-in `wrangler.jsonc` already names the resources. Create them once:

```bash
npx wrangler d1 create twivter-db
npx wrangler r2 bucket create twivter-media
npx wrangler r2 bucket create twivter-cache
```

`d1 create` prints a `database_id`. Paste it into `wrangler.jsonc`:

```jsonc
"d1_databases": [
  {
    "binding": "DB",
    "database_name": "twivter-db",
    "database_id": "<paste-the-id-here>",
    "migrations_dir": "migrations"
  }
]
```

Verify the config resolves:

```bash
npx wrangler types --env-interface CloudflareEnv cloudflare-env.d.ts
```

Rerun this whenever `wrangler.jsonc` changes.

## 3. Apply the database schema

```bash
npx wrangler d1 migrations apply twivter-db --remote
```

This creates every table and index in `migrations/0001_init.sql`. To confirm:

```bash
npx wrangler d1 execute twivter-db --remote --command "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
```

## 4. Set secrets

Secrets are stored in Cloudflare, not in the repo.

```bash
# Signs the session cookie. Rotating this logs everyone out.
npx wrangler secret put SESSION_SECRET

# Shared secret between the ChatUser Durable Object and /api/chat/relay.
npx wrangler secret put CHAT_INTERNAL_SECRET
```

Generate values with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

> While `CHAT_INTERNAL_SECRET` is unset, `/api/chat/relay` rejects every request.
> Messages still deliver (they are pushed straight from the send endpoint), but
> typing indicators and read receipts stay off. This is deliberate: a missing
> secret must fail closed rather than turn the endpoint into an open relay.

Optionally, `CHAT_ALLOWED_ORIGINS` restricts which origins may open the chat
WebSocket (comma-separated).

## 5. Load demo data (optional)

```bash
npx wrangler d1 execute twivter-db --remote --file=./scripts/seed.mjs
```

This truncates and repopulates every table. Demo login: `yowanda@twivter.com` /
`password123`.

## 6. Deploy

```bash
bun run deploy
```

That runs `opennextjs-cloudflare build` then `opennextjs-cloudflare deploy`.
The Worker is named `twivter`; it is reachable at
`https://twivter.<your-subdomain>.workers.dev` until you attach a custom domain.

## 7. Post-deploy checklist

- [ ] `GET /api/explore` returns trending tags and posts
- [ ] Register a new account, complete onboarding
- [ ] Create a post with an image (uploads to R2, served from `/uploads/...`)
- [ ] Open Messages in two browsers with different accounts and send both ways
- [ ] Check that realtime typing indicators appear for the other account
- [ ] Open the Admin dashboard as `yowanda@twivter.com`

Two scripts check all of this automatically:

```bash
bun run smoke            # 95 HTTP/API checks against a running server
bun run verify:cloud     # R2 round-trip + Durable Object WebSocket + security
```

`verify:cloud` accepts a base URL argument:

```bash
node scripts/verify-cloud.mjs https://twivter.<your-subdomain>.workers.dev
```

## Local development

```bash
bun run db:local      # apply migrations to the local D1 emulator
bun run db:seed       # demo data locally
bun run dev           # Next.js dev server on :3000
bun run smoke         # end-to-end API test suite against :3000
```

`next dev` resolves D1 and R2 bindings locally through
`initOpenNextCloudflareForDev()` in `next.config.ts`. `.dev.vars` supplies
`SESSION_SECRET` for the dev server.

> **Durable Objects do not run under `next dev`.** Wrangler reports
> "A DurableObjectNamespace in the config referenced the class ChatUser, but no
> such Durable Object class is exported from the worker" — the dev server loads
> the OpenNext dev worker, not `worker.ts`, so the chat WebSocket cannot connect.
>
> The client handles this: when the socket is unavailable it falls back to
> polling `/api/conversations/[id]/messages` every 5 seconds, so chat still
> works in dev. To test true realtime, run the Worker in the real runtime with
> `bun run preview` (which builds and serves through `wrangler dev`).

To test in the real Workers runtime instead of the dev server:

```bash
bun run preview
```

Other useful commands:

```bash
bun run typecheck      # both TS projects (app + worker)
bun run lint
bun run db:studio      # browse the local database
node scripts/gen-hash.cjs password123   # regenerate the seed password hash
```

## Troubleshooting

**`D1 binding "DB" tidak ditemukan`** — `database_id` is still the placeholder
in `wrangler.jsonc`, or you ran `d1 create` but never copied the id.

**`R2 binding "MEDIA" tidak ditemukan`** — run `npx wrangler r2 bucket create
twivter-media`.

**Uploads fail with 400** — the browser could not decode the image. `WEBP` and
`AVIF` encoding are unsupported on very old browsers; the client falls back to
JPEG automatically, but a corrupt file will be rejected.

**Chat never connects** — check the browser console. A `426` means the request
was not a WebSocket upgrade; a `401` means the session cookie is missing or the
`Session` row was deleted by logging out elsewhere.

**Media returns 404** — objects are served by `/uploads/[...path]`, which reads
from the `MEDIA` bucket. Make sure uploaded objects are not being written to a
different bucket than the one bound as `MEDIA`.

**Deploy fails with "Durable Object class not found"** — `wrangler.jsonc` must
point `main` at `./worker.ts`, and `worker.ts` must export the `ChatUser` class.

## Project structure

```
migrations/0001_init.sql   D1 schema
scripts/seed.mjs           demo data
worker.ts                  Worker entry (OpenNext handler + ChatUser)
wrangler.jsonc             bindings, DO migration, compatibility flags
open-next.config.ts        OpenNext adapter config (R2 incremental cache)
tsconfig.json              app code (DOM types)
tsconfig.worker.json       worker-only code (workers-types)
docs/DATA-LAYER.md         database contract every route follows
```