/**
 * Worker entry point.
 *
 * OpenNext generates `.open-next/worker.js` at build time, which only exports a
 * `fetch` handler. This wrapper re-exports it and adds the `ChatUser` Durable
 * Object, so realtime chat ships inside the same Worker as the app instead of
 * the old separate socket.io process.
 *
 * It also handles `/api/chat/socket` itself. A Next.js route handler cannot
 * return a `101` upgrade — the response is normalised and the WebSocket is
 * dropped — so the upgrade is intercepted here, before the request reaches
 * Next. Authentication is done against the same session cookie using
 * `resolveSessionUser`, so there is still only one auth mechanism.
 *
 * See https://opennext.js.org/cloudflare/howtos/custom-worker
 */

// @ts-ignore `.open-next/worker.js` is generated at build time
import { default as handler } from './.open-next/worker.js'
import { ChatUser } from './src/cloudflare/chat-user'
import { resolveSessionUser } from './src/cloudflare/session'

export { ChatUser }

interface Env {
  CHAT_USER: DurableObjectNamespace
  DB: {
    prepare: (query: string) => {
      bind: (...values: unknown[]) => { first: <T>() => Promise<T | null> }
    }
  }
}

/** Matches `/api/chat/socket` exactly. */
function isChatSocket(url: URL): boolean {
  return url.pathname === '/api/chat/socket'
}

async function handleChatSocket(request: Request, env: Env): Promise<Response> {
  if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') {
    // Distinct from the Next route's message so it is obvious which layer
    // answered when diagnosing a deployment.
    return new Response('[worker.ts] Expected a WebSocket upgrade', {
      status: 426,
      headers: { 'content-type': 'text/plain' },
    })
  }

  // Same session cookie the rest of the app uses; verified before the upgrade so
  // an unauthenticated client gets a plain 401 rather than an open socket.
  let user: { id: string } | null = null
  try {
    user = await resolveSessionUser(request, env.DB)
  } catch (err) {
    console.error('[chat] session lookup failed', err)
  }
  if (!user) {
    return new Response('Unauthorized', { status: 401, headers: { 'content-type': 'text/plain' } })
  }

  const stub = env.CHAT_USER.get(env.CHAT_USER.idFromName(user.id))
  return stub.fetch(`https://chat.internal/?userId=${encodeURIComponent(user.id)}`, request)
}

export default {
  fetch: async (request: Request, env: Env, ctx: ExecutionContext) => {
    const url = new URL(request.url)
    if (isChatSocket(url)) {
      return handleChatSocket(request, env)
    }
    return handler.fetch(request, env, ctx)
  },
} satisfies ExportedHandler<Env>