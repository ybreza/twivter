/**
 * `ChatUser` — one Durable Object per user, holding that user's live WebSocket
 * connections.
 *
 * This replaces the old socket.io mini-service, which required a separate
 * long-running Node process. Cloudflare Durable Objects run inside the same
 * Worker as the app, so there is no second service to deploy, monitor or pay
 * for, and the WebSocket Hibernation API means an idle connection costs
 * nothing: the object can be evicted from memory and the socket is restored
 * from storage when traffic resumes.
 *
 * Fan-out model: the sender posts a message over HTTP
 * (`POST /api/conversations/[id]/messages`), which persists it and then pushes
 * to each recipient's object. Clients only ever *receive* over the socket, so a
 * client cannot spoof delivery to somebody else's conversation.
 */

interface Env {
  CHAT_USER: DurableObjectNamespace
  WORKER_SELF_REFERENCE: Fetcher
  /** Shared secret so only our own worker can call the fan-out endpoint. */
  CHAT_INTERNAL_SECRET?: string
}

/** Sent to the worker to resolve recipients and relay to their objects. */
type RelayRequest =
  | { kind: 'typing'; conversationId: string; userId: string; typing: boolean }
  | { kind: 'read'; conversationId: string; userId: string }

/** Events pushed from the worker down to the browser. */
type PushEvent =
  | { type: 'message'; conversationId: string; message: unknown; senderId: string }
  | { type: 'typing'; conversationId: string; userId: string; typing: boolean }
  | { type: 'read'; conversationId: string; userId: string }
  | { type: 'hello'; userId: string; connectionId: string }

/** Client → object frames. */
type ClientFrame =
  | { type: 'typing'; conversationId: string; typing: boolean }
  | { type: 'read'; conversationId: string }
  | { type: 'ping' }

const MAX_TEXT_FRAME_BYTES = 2048

export class ChatUser implements DurableObject {
  constructor(
    private readonly state: DurableObjectState,
    private readonly env: Env,
  ) {}

  /**
   * HTTP surface for this object.
   *   - `GET  /` with `Upgrade: websocket` → attach a browser connection
   *   - `POST /push`                     → broadcast a `PushEvent` to all sockets
   */
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)

    if (url.pathname === '/push' && request.method === 'POST') {
      const event = await readJson<PushEvent>(request)
      if (!event) return new Response('Bad Request', { status: 400 })
      this.broadcast(event)
      return new Response(null, { status: 204 })
    }

    if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') {
      return new Response('Expected a WebSocket upgrade', { status: 426 })
    }

    const userId = decodeURIComponent(url.searchParams.get('userId') ?? '')
    if (!userId) return new Response('Missing userId', { status: 400 })

    const pair = new WebSocketPair()
    const client = pair[0]
    const server = pair[1]

    // Hibernation API: the socket survives this object being evicted from memory.
    this.state.acceptWebSocket(server)
    // Tags let us find "this user's" sockets without keeping them in memory.
    server.serializeAttachment({ userId })

    // Answer pings from the platform automatically so idle sockets stay alive
    // without a Durable Object alarm.
    this.state.setWebSocketAutoResponse(
      new WebSocketRequestResponsePair(JSON.stringify({ type: 'pong' }), JSON.stringify({ type: 'ping' })),
    )

    try {
      this.broadcast({ type: 'hello', userId, connectionId: crypto.randomUUID() })
    } catch {
      // No other sockets yet; nothing to do.
    }

    return new Response(null, { status: 101, webSocket: client })
  }

  // ── Hibernation handlers ────────────────────────────────────────────

  async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer): Promise<void> {
    if (typeof raw !== 'string' || raw.length > MAX_TEXT_FRAME_BYTES) return

    let frame: ClientFrame
    try {
      frame = JSON.parse(raw) as ClientFrame
    } catch {
      return
    }

    const attachment = ws.deserializeAttachment() as { userId?: string } | null
    const userId = attachment?.userId
    if (!userId) {
      ws.close(1008, 'Unauthenticated')
      return
    }

    if (frame.type === 'ping') {
      ws.send(JSON.stringify({ type: 'pong' }))
      return
    }

    // The browser never names itself; the object's identity is authoritative.
    const relay: RelayRequest =
      frame.type === 'typing'
        ? { kind: 'typing', conversationId: frame.conversationId, userId, typing: Boolean(frame.typing) }
        : { kind: 'read', conversationId: frame.conversationId, userId }

    await this.relayToWorker(relay)
  }

  async webSocketClose(ws: WebSocket): Promise<void> {
    try {
      ws.close()
    } catch {
      // Already closed.
    }
  }

  async webSocketError(): Promise<void> {
    // Nothing to clean up: attachment lives with the socket, not in memory.
  }

  // ── Internals ────────────────────────────────────────────────────────

  private broadcast(event: PushEvent): void {
    const payload = JSON.stringify(event)
    for (const ws of this.state.getWebSockets()) {
      try {
        ws.send(payload)
      } catch {
        // Dead socket; the close handler will remove it.
      }
    }
  }

  /**
   * Asks the worker to resolve the conversation's other members and push to
   * their objects. Uses the `WORKER_SELF_REFERENCE` service binding rather than
   * a public URL so it works for custom domains and preview environments.
   */
  private async relayToWorker(relay: RelayRequest): Promise<void> {
    try {
      await this.env.WORKER_SELF_REFERENCE.fetch('https://internal/api/chat/relay', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(this.env.CHAT_INTERNAL_SECRET
            ? { 'x-twivter-internal': this.env.CHAT_INTERNAL_SECRET }
            : {}),
        },
        body: JSON.stringify(relay),
      })
    } catch (err) {
      // Realtime is best-effort; the durable record in D1 is the source of
      // truth, and the client re-fetches on reconnect.
      console.warn('[chat] relay failed', err)
    }
  }
}

/** Parses a JSON body without throwing on malformed input. */
async function readJson<T>(request: Request): Promise<T | null> {
  try {
    return (await request.json()) as T
  } catch {
    return null
  }
}