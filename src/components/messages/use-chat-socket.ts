'use client'

/**
 * Realtime chat over a native WebSocket backed by a Cloudflare Durable Object.
 *
 * Replaces `socket.io-client`, which needed a separate Node service on port
 * 3003 reachable through a Caddy gateway. The socket now lives inside the same
 * Worker and is authenticated with the normal session cookie, so there is no
 * extra deployment, no gateway rule and no second auth path.
 *
 * Messages are **sent over HTTP**, not over this socket: the server persists
 * them and then pushes to the recipients. This keeps D1 as the single source of
 * truth and means a dropped socket can never lose a message.
 */
import { useCallback, useEffect, useRef, useState } from 'react'

export interface ChatMessageEvent {
  type: 'message'
  conversationId: string
  message: unknown
  senderId: string
}

export interface ChatTypingEvent {
  type: 'typing'
  conversationId: string
  userId: string
  typing: boolean
}

export interface ChatReadEvent {
  type: 'read'
  conversationId: string
  userId: string
}

export type ChatEvent = ChatMessageEvent | ChatTypingEvent | ChatReadEvent

export interface UseChatSocketOptions {
  /** Set when the user is authenticated. The socket is only opened when set. */
  userId: string | null
  username: string
  onMessage?: (event: ChatMessageEvent) => void
  onTyping?: (event: ChatTypingEvent) => void
  onRead?: (event: ChatReadEvent) => void
  /** Called after the socket (re)connects, so the view can re-sync. */
  onReconnect?: () => void
  /**
   * Invoked on a timer while the socket is unavailable.
   *
   * A Durable Object is not loaded by `next dev`, and some networks block
   * WebSockets outright. Polling keeps the view correct in both cases instead of
   * silently going stale. Omit to disable.
   */
  onFallbackPoll?: () => void
  /** Poll interval used when the socket is down. Default 5000ms. */
  fallbackPollMs?: number
}

const MAX_BACKOFF_MS = 15_000
const BASE_BACKOFF_MS = 800
/** Ping cadence; keeps intermediaries from dropping an idle socket. */
const HEARTBEAT_MS = 25_000

export function useChatSocket(options: UseChatSocketOptions) {
  const {
    userId,
    username,
    onMessage,
    onTyping,
    onRead,
    onReconnect,
    onFallbackPoll,
    fallbackPollMs = 5000,
  } = options

  const [connected, setConnected] = useState(false)

  const socketRef = useRef<WebSocket | null>(null)
  const attemptsRef = useRef(0)
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const closedRef = useRef(false)

  // Callbacks are read through refs so changing them never tears down the socket.
  // Assigned in an effect rather than during render: writing a ref while
  // rendering is a side effect React may run more than once.
  const handlersRef = useRef({ onMessage, onTyping, onRead, onReconnect, onFallbackPoll })
  useEffect(() => {
    handlersRef.current = { onMessage, onTyping, onRead, onReconnect, onFallbackPoll }
  }, [onMessage, onTyping, onRead, onReconnect, onFallbackPoll])

  const cleanup = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current)
      reconnectTimerRef.current = null
    }
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current)
      heartbeatRef.current = null
    }
    const socket = socketRef.current
    socketRef.current = null
    if (socket) {
      // Detach first: a close() must not schedule another reconnect.
      socket.onopen = null
      socket.onclose = null
      socket.onerror = null
      socket.onmessage = null
      if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
        socket.close()
      }
    }
    setConnected(false)
  }, [])

  useEffect(() => {
    // When `userId` clears, React has already run this effect's previous cleanup,
// which tore the socket down and reset `connected`. Calling `cleanup()` again
// here would be a redundant synchronous setState during render.
    if (!userId) return

    closedRef.current = false

    const connect = () => {
      if (closedRef.current) return

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      const socket = new WebSocket(`${protocol}//${window.location.host}/api/chat/socket`)
      socketRef.current = socket

      socket.onopen = () => {
        if (closedRef.current) return
        setConnected(true)
        attemptsRef.current = 0
        // A fresh connection may have missed events while it was down.
        handlersRef.current.onReconnect?.()
        heartbeatRef.current = setInterval(() => {
          if (socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ type: 'ping' }))
          }
        }, HEARTBEAT_MS)
      }

      socket.onmessage = (event) => {
        let data: ChatEvent
        try {
          data = JSON.parse(event.data as string) as ChatEvent
        } catch {
          return
        }
        switch (data.type) {
          case 'message':
            handlersRef.current.onMessage?.(data)
            break
          case 'typing':
            handlersRef.current.onTyping?.(data)
            break
          case 'read':
            handlersRef.current.onRead?.(data)
            break
          default:
            break
        }
      }

      socket.onerror = () => {
        // `onclose` always follows, which is where reconnection is scheduled.
      }

      socket.onclose = () => {
        if (heartbeatRef.current) {
          clearInterval(heartbeatRef.current)
          heartbeatRef.current = null
        }
        setConnected(false)
        if (closedRef.current) return
        // Exponential backoff with jitter, capped.
        attemptsRef.current += 1
        const delay = Math.min(BASE_BACKOFF_MS * 2 ** (attemptsRef.current - 1), MAX_BACKOFF_MS)
        const jitter = Math.random() * 400
        reconnectTimerRef.current = setTimeout(connect, delay + jitter)
      }
    }

    connect()

    // Pause reconnects while the tab is hidden; resume immediately when it returns.
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        const socket = socketRef.current
        if (!socket || socket.readyState === WebSocket.CLOSED) {
          attemptsRef.current = 0
          if (reconnectTimerRef.current) {
            clearTimeout(reconnectTimerRef.current)
            reconnectTimerRef.current = null
          }
          connect()
        }
      }
    }
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      closedRef.current = true
      document.removeEventListener('visibilitychange', onVisibility)
      cleanup()
    }
  }, [userId, username, cleanup])

  /**
   * Poll while the socket is down so the transcript still refreshes.
   * Paused as soon as the socket is live, so the two mechanisms never double-fetch.
   */
  useEffect(() => {
    if (!userId || connected || !onFallbackPoll || fallbackPollMs <= 0) return
    const id = setInterval(() => {
      handlersRef.current.onFallbackPoll?.()
    }, fallbackPollMs)
    return () => clearInterval(id)
  }, [userId, connected, onFallbackPoll, fallbackPollMs])

  /** Sends a typing indicator. Fire-and-forget; failures are non-fatal. */
  const sendTyping = useCallback((conversationId: string, typing: boolean) => {
    const socket = socketRef.current
    if (socket?.readyState !== WebSocket.OPEN) return
    try {
      socket.send(JSON.stringify({ type: 'typing', conversationId, typing }))
    } catch {
      // Ignore: the indicator is cosmetic and self-corrects after 2s.
    }
  }, [])

  /** Tells the conversation the user has read it. */
  const markRead = useCallback((conversationId: string) => {
    const socket = socketRef.current
    if (socket?.readyState !== WebSocket.OPEN) return
    try {
      socket.send(JSON.stringify({ type: 'read', conversationId }))
    } catch {
      // Ignore.
    }
  }, [])

  return { connected, sendTyping, markRead }
}