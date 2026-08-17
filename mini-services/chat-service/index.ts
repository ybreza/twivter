// Twivter Chat Service — socket.io mini-service for realtime DM delivery.
// Listens on port 3003. Path MUST stay "/" so Caddy can forward the request
// from /?XTransformPort=3003 to this service.
//
// Responsibilities (stateless beyond the socket<->userId mapping):
//   - On connect: emit `hello` so the client can confirm transport.
//   - `auth` { userId, username } → record mapping, join room `user:${userId}`.
//   - `message:send` { conversationId, message, recipientIds } → for each
//     recipientId, emit `message:new` to room `user:${recipientId}`.
//     Sender is NOT in recipientIds (the API already returned the message
//     to the sender via HTTP), so the sender does not receive an echo here.
//   - `typing:start` / `typing:stop` { conversationId, userId, recipientIds }
//   - `conversation:read` { conversationId, recipientIds }
//   - On disconnect: drop mapping.
//
// NOTE: messages themselves are persisted by the Next.js API route; this
// service is purely a fan-out relay for realtime UI updates.

import { createServer } from 'http'
import { Server, Socket } from 'socket.io'

interface AuthInfo {
  userId: string
  username: string
}

interface MessagePayload {
  conversationId: string
  message: any
  recipientIds: string[]
}

interface TypingPayload {
  conversationId: string
  userId: string
  recipientIds: string[]
}

interface ReadPayload {
  conversationId: string
  recipientIds: string[]
}

const httpServer = createServer((req, res) => {
  // Tiny health-check endpoint
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ ok: true, service: 'twivter-chat-service', uptime: process.uptime() }))
    return
  }
  res.writeHead(200, { 'Content-Type': 'text/plain' })
  res.end('Twivter chat service is running. Connect via socket.io at /?XTransformPort=3003.')
})

const io = new Server(httpServer, {
  cors: {
    origin: process.env.NODE_ENV === "production"
      ? ["https://twivter.vercel.app"]  // ganti URL Anda
      : ["http://localhost:3000"],
    methods: ["GET", "POST"]
  }
})

const socketsByUser = new Map<string, Set<string>>() // userId → set of socketIds (multi-tab)
const userBySocket = new Map<string, AuthInfo>() // socketId → user

function roomFor(userId: string) {
  return `user:${userId}`
}

function emitToUser(userId: string, event: string, payload: any) {
  io.to(roomFor(userId)).emit(event, payload)
}

io.on('connection', (socket: Socket) => {
  console.log(`[chat] socket connected: ${socket.id}`)

  socket.emit('hello', { socketId: socket.id })

  socket.on('auth', (data: AuthInfo) => {
    if (!data || !data.userId || !data.username) {
      console.warn(`[chat] invalid auth payload from ${socket.id}`)
      return
    }
    userBySocket.set(socket.id, { userId: data.userId, username: data.username })
    let set = socketsByUser.get(data.userId)
    if (!set) {
      set = new Set()
      socketsByUser.set(data.userId, set)
    }
    set.add(socket.id)
    socket.join(roomFor(data.userId))
    console.log(`[chat] authenticated socket ${socket.id} → user ${data.userId} (${data.username})`)
  })

  socket.on('message:send', (payload: MessagePayload) => {
    if (!payload || !payload.recipientIds || !payload.message) return
    const sender = userBySocket.get(socket.id)
    if (!sender) return
    console.log(
      `[chat] relay message conv=${payload.conversationId} from=${sender.userId} to=${payload.recipientIds.length} recipients`
    )
    for (const rid of payload.recipientIds) {
      // Sender is not in recipientIds by design — emit only to recipients.
      emitToUser(rid, 'message:new', {
        conversationId: payload.conversationId,
        message: payload.message,
        senderId: sender.userId,
      })
    }
  })

  socket.on('typing:start', (payload: TypingPayload) => {
    if (!payload || !payload.recipientIds) return
    for (const rid of payload.recipientIds) {
      emitToUser(rid, 'typing:start', {
        conversationId: payload.conversationId,
        userId: payload.userId,
      })
    }
  })

  socket.on('typing:stop', (payload: TypingPayload) => {
    if (!payload || !payload.recipientIds) return
    for (const rid of payload.recipientIds) {
      emitToUser(rid, 'typing:stop', {
        conversationId: payload.conversationId,
        userId: payload.userId,
      })
    }
  })

  socket.on('conversation:read', (payload: ReadPayload) => {
    if (!payload || !payload.recipientIds) return
    for (const rid of payload.recipientIds) {
      emitToUser(rid, 'conversation:read', {
        conversationId: payload.conversationId,
      })
    }
  })

  socket.on('disconnect', () => {
    const info = userBySocket.get(socket.id)
    if (info) {
      userBySocket.delete(socket.id)
      const set = socketsByUser.get(info.userId)
      if (set) {
        set.delete(socket.id)
        if (set.size === 0) socketsByUser.delete(info.userId)
      }
      console.log(`[chat] socket disconnected: ${socket.id} (user ${info.userId})`)
    } else {
      console.log(`[chat] socket disconnected: ${socket.id}`)
    }
  })

  socket.on('error', (err: any) => {
    console.error(`[chat] socket error (${socket.id}):`, err)
  })
})

const PORT = process.env.PORT || 3003
httpServer.listen(PORT, () => {
  console.log(`💬 Twivter chat service listening on port ${PORT}`)
})

process.on('SIGTERM', () => {
  console.log('[chat] SIGTERM, shutting down...')
  io.close(() => {
    httpServer.close(() => process.exit(0))
  })
})

process.on('SIGINT', () => {
  console.log('[chat] SIGINT, shutting down...')
  io.close(() => {
    httpServer.close(() => process.exit(0))
  })
})
