/**
 * The chat WebSocket is handled in `worker.ts`, not here.
 *
 * A Next.js route handler cannot return a `101` upgrade: the response is
 * normalised before it leaves the framework and the WebSocket is dropped, so the
 * client saw "socket errored" and the feature never worked. Intercepting
 * `/api/chat/socket` in the Worker entry (before the request reaches Next) is
 * the supported approach with OpenNext.
 *
 * This route remains so the URL resolves and gives a clear diagnostic instead
 * of a confusing framework 404 — for example when someone curls the endpoint by
 * hand instead of upgrading it.
 */
import { withErrorHandler } from '@/lib/api'

export const dynamic = 'force-dynamic'

export const GET = withErrorHandler(async (req) => {
  const upgrade = req.headers.get('Upgrade')?.toLowerCase()
  if (upgrade !== 'websocket') {
    return new Response('Expected a WebSocket upgrade', {
      status: 426,
      headers: { 'content-type': 'text/plain' },
    })
  }
  // Reaching here means the Worker-level interception was bypassed (for example
  // if `main` in wrangler.jsonc was pointed back at `.open-next/worker.js`).
  return new Response(
    'WebSocket upgrades are handled by the Worker entry point. Check that wrangler.jsonc sets "main": "./worker.ts".',
    { status: 501, headers: { 'content-type': 'text/plain' } },
  )
})