/**
 * Realtime chat fan-out over Durable Objects.
 *
 * One `ChatUser` object per user holds that user's sockets. To reach somebody we
 * address their object directly, so a message to a group conversation only
 * touches the recipients rather than every connected user.
 */
import { getCloudflareContext } from '@opennextjs/cloudflare'
import type { DurableObjectNamespaceLike } from './worker-bindings'

export type ChatPushEvent =
  | { type: 'message'; conversationId: string; message: unknown; senderId: string }
  | { type: 'typing'; conversationId: string; userId: string; typing: boolean }
  | { type: 'read'; conversationId: string; userId: string }

/** Resolves the CHAT_USER Durable Object namespace. */
export async function chatNamespace(): Promise<DurableObjectNamespaceLike | null> {
  const { env } = await getCloudflareContext({ async: true })
  return ((env as Record<string, unknown> | undefined)?.CHAT_USER as
    | DurableObjectNamespaceLike
    | undefined) ?? null
}

/**
 * Pushes an event to every connected socket belonging to `userIds`.
 *
 * Best-effort by design: D1 holds the durable record, and the client re-fetches
 * on reconnect, so a failed push degrades to "no live update" rather than data
 * loss. Never throws.
 */
export async function pushToUsers(userIds: string[], event: ChatPushEvent): Promise<void> {
  if (userIds.length === 0) return
  const namespace = await chatNamespace()
  if (!namespace) return

  const body = JSON.stringify(event)
  await Promise.allSettled(
    userIds.map((userId) =>
      namespace
        .get(namespace.idFromName(userId))
        .fetch('https://chat.internal/push', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body,
        }),
    ),
  )
}