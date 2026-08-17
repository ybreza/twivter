'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { io, Socket } from 'socket.io-client'
import type { MessageDTO, AuthorDTO } from '@/lib/types'

// ── Socket payloads ─────────────────────────────
export interface IncomingMessagePayload {
  conversationId: string
  message: MessageDTO & { sender?: AuthorDTO }
  senderId: string
}

export interface TypingPayload {
  conversationId: string
  userId: string
}

export interface ReadPayload {
  conversationId: string
}

export interface ChatSocketCallbacks {
  onMessage?: (payload: IncomingMessagePayload) => void
  onTyping?: (payload: TypingPayload & { isTyping: boolean }) => void
  onRead?: (payload: ReadPayload) => void
}

interface UseChatSocketArgs {
  userId: string | null | undefined
  username: string | null | undefined
  callbacks: ChatSocketCallbacks
}

/**
 * Manages a single socket.io connection to the Twivter chat-service.
 *
 * Connection uses the gateway-safe URL `/?XTransformPort=3003` with
 * `path: '/'` — required for the Caddy gateway to forward to port 3003.
 *
 * Exposes imperative helpers (sendMessage / sendTyping / markRead) so the
 * view can drive the realtime layer while persistence stays in the API.
 */
export function useChatSocket({ userId, username, callbacks }: UseChatSocketArgs) {
  const socketRef = useRef<Socket | null>(null)
  const callbacksRef = useRef(callbacks)
  const userIdRef = useRef<string | null>(userId ?? null)

  // Keep refs in sync without touching them during render.
  useEffect(() => {
    callbacksRef.current = callbacks
  }, [callbacks])
  useEffect(() => {
    userIdRef.current = userId ?? null
  }, [userId])

  const [connected, setConnected] = useState(false)

  useEffect(() => {
    if (!userId || !username) return

    const socket = io('/?XTransformPort=3003', {
      path: '/',
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 10000,
    })
    socketRef.current = socket

    const onConnect = () => {
      setConnected(true)
      socket.emit('auth', { userId, username })
    }
    const onDisconnect = () => setConnected(false)
    const onMessage = (p: IncomingMessagePayload) => callbacksRef.current.onMessage?.(p)
    const onTypingStart = (p: TypingPayload) =>
      callbacksRef.current.onTyping?.({ ...p, isTyping: true })
    const onTypingStop = (p: TypingPayload) =>
      callbacksRef.current.onTyping?.({ ...p, isTyping: false })
    const onRead = (p: ReadPayload) => callbacksRef.current.onRead?.(p)

    socket.on('connect', onConnect)
    socket.on('disconnect', onDisconnect)
    socket.on('message:new', onMessage)
    socket.on('typing:start', onTypingStart)
    socket.on('typing:stop', onTypingStop)
    socket.on('conversation:read', onRead)

    return () => {
      socket.off('connect', onConnect)
      socket.off('disconnect', onDisconnect)
      socket.off('message:new', onMessage)
      socket.off('typing:start', onTypingStart)
      socket.off('typing:stop', onTypingStop)
      socket.off('conversation:read', onRead)
      socket.disconnect()
      socketRef.current = null
      setConnected(false)
    }
  }, [userId, username])

  const sendMessage = useCallback(
    (conversationId: string, message: MessageDTO, recipientIds: string[]) => {
      if (!recipientIds.length) return
      socketRef.current?.emit('message:send', { conversationId, message, recipientIds })
    },
    []
  )

  const sendTyping = useCallback(
    (conversationId: string, recipientIds: string[], isTyping: boolean) => {
      if (!recipientIds.length) return
      const uid = userIdRef.current
      if (!uid) return
      const event = isTyping ? 'typing:start' : 'typing:stop'
      socketRef.current?.emit(event, { conversationId, userId: uid, recipientIds })
    },
    []
  )

  const markRead = useCallback((conversationId: string, recipientIds: string[]) => {
    if (!recipientIds.length) return
    socketRef.current?.emit('conversation:read', { conversationId, recipientIds })
  }, [])

  return { connected, sendMessage, sendTyping, markRead }
}
