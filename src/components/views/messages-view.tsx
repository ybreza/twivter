'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { toast } from 'sonner'
import {
  MessageSquare,
  Search,
  PenSquare,
  ArrowLeft,
  Send,
  Users,
  Loader2,
  X,
  CheckCheck,
} from 'lucide-react'

import { useViewStore, useAuthStore } from '@/stores/app-store'
import { useApi, apiPost } from '@/lib/hooks'
import { timeAgo } from '@/lib/api'
import type { ConversationDTO, MessageDTO, AuthorDTO, ProfileDTO } from '@/lib/types'

import { UserAvatar } from '@/components/user-avatar'
import { ViewHeader, EmptyState, LoadingState, ErrorState } from '@/components/shared-states'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { useChatSocket, IncomingMessagePayload } from '@/components/messages/use-chat-socket'

// Extended MessageDTO with optional sender info (returned by the API when
// listing messages, included for group display).
type ChatMessage = MessageDTO & { sender?: AuthorDTO }

// ───────────────────────────────────────────────
// Top-level view
// ───────────────────────────────────────────────
export function MessagesView() {
  const { conversationId, setConversation, navigate } = useViewStore()
  const user = useAuthStore((s) => s.user)
  const [refreshKey, setRefreshKey] = useState(0)

  const { data, loading, error, refetch } = useApi<{ conversations: ConversationDTO[] }>(
    '/api/conversations',
    { deps: [refreshKey] }
  )

  const conversations = data?.conversations ?? []

  return (
    <div className="flex h-[calc(100dvh-7rem)] md:h-screen overflow-hidden">
      {/* Left pane — conversation list */}
      <aside
        className={cn(
          'w-full md:w-80 lg:w-96 shrink-0 border-r border-border flex flex-col bg-background',
          conversationId && 'hidden md:flex'
        )}
      >
        <ViewHeader
          title="Pesan"
          rightSlot={<NewMessageButton onCreated={(c) => {
            setConversation(c.id)
            setRefreshKey((k) => k + 1)
          }} />}
        />
        <div className="px-3 pb-3 border-b border-border">
          <ConversationSearch
            conversations={conversations}
            onSelect={(id) => setConversation(id)}
          />
        </div>
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <ConversationListSkeleton />
          ) : error ? (
            <ErrorState message={error} onRetry={refetch} />
          ) : conversations.length === 0 ? (
            <EmptyState
              icon={MessageSquare}
              title="Belum ada pesan"
              description="Mulai percakapan baru dengan menekan tombol di kanan atas."
            />
          ) : (
            <ConversationList
              conversations={conversations}
              activeId={conversationId}
              currentUserId={user?.id ?? null}
              onSelect={(id) => setConversation(id)}
            />
          )}
        </div>
      </aside>

      {/* Right pane — chat window */}
      <section className={cn('flex-1 flex flex-col bg-background', !conversationId && 'hidden md:flex')}>
        {conversationId ? (
          <ChatWindow
            conversationId={conversationId}
            onBack={() => {
              setConversation('' as any)
              navigate('messages')
            }}
            onConversationChanged={() => setRefreshKey((k) => k + 1)}
          />
        ) : (
          <EmptyState
            icon={MessageSquare}
            title="Pilih percakapan"
            description="Pilih percakapan dari daftar untuk mulai mengobrol."
            className="m-auto"
          />
        )}
      </section>
    </div>
  )
}

// ───────────────────────────────────────────────
// Conversation search (filter locally)
// ───────────────────────────────────────────────
function ConversationSearch({
  conversations,
  onSelect,
}: {
  conversations: ConversationDTO[]
  onSelect: (id: string) => void
}) {
  const [q, setQ] = useState('')
  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase()
    if (!t) return conversations
    return conversations.filter((c) => {
      const name = displayConversationName(c).toLowerCase()
      return name.includes(t)
    })
  }, [q, conversations])

  if (filtered.length === 0 && q) {
    return (
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Cari percakapan..."
          className="pl-9 rounded-full bg-muted border-transparent focus-visible:bg-background focus-visible:border-primary"
        />
        <p className="text-xs text-muted-foreground mt-2 text-center">Tidak ada yang cocok.</p>
      </div>
    )
  }
  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      <Input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Cari percakapan..."
        className="pl-9 rounded-full bg-muted border-transparent focus-visible:bg-background focus-visible:border-primary"
      />
      {q && (
        <button
          onClick={() => setQ('')}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          aria-label="Hapus pencarian"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  )
}

// ───────────────────────────────────────────────
// Conversation list
// ───────────────────────────────────────────────
function ConversationList({
  conversations,
  activeId,
  currentUserId,
  onSelect,
}: {
  conversations: ConversationDTO[]
  activeId: string | null
  currentUserId: string | null
  onSelect: (id: string) => void
}) {
  return (
    <ul>
      {conversations.map((c) => (
        <li key={c.id}>
          <button
            onClick={() => onSelect(c.id)}
            className={cn(
              'w-full text-left px-4 py-3 hover:bg-muted/50 transition-colors flex gap-3 items-start border-b border-border',
              activeId === c.id && 'bg-muted/70'
            )}
          >
            <ConversationAvatar conversation={c} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-[15px] truncate">
                  {displayConversationName(c)}
                </span>
                {c.lastMessage && (
                  <span className="text-xs text-muted-foreground shrink-0">
                    {timeAgo(c.lastMessage.createdAt)}
                  </span>
                )}
              </div>
              <div className="flex items-center justify-between gap-2 mt-0.5">
                <span className="text-sm text-muted-foreground truncate flex-1">
                  {c.lastMessage ? (
                    <>
                      {c.type === 'group' && c.lastMessage.senderId && (
                        <span className="text-foreground/70">
                          {c.lastMessage.senderId === currentUserId ? 'Anda: ' : ''}
                        </span>
                      )}
                      {c.lastMessage.content}
                    </>
                  ) : (
                    <span className="italic">Belum ada pesan</span>
                  )}
                </span>
                {c.unreadCount > 0 && (
                  <span className="shrink-0 min-w-5 h-5 px-1.5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">
                    {c.unreadCount > 99 ? '99+' : c.unreadCount}
                  </span>
                )}
              </div>
            </div>
          </button>
        </li>
      ))}
    </ul>
  )
}

function ConversationListSkeleton() {
  return (
    <ul>
      {Array.from({ length: 6 }).map((_, i) => (
        <li key={i} className="px-4 py-3 border-b border-border flex gap-3">
          <Skeleton className="h-12 w-12 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3 w-32" />
            <Skeleton className="h-3 w-48" />
          </div>
        </li>
      ))}
    </ul>
  )
}

// ───────────────────────────────────────────────
// Conversation avatar (group icon or other member avatar)
// ───────────────────────────────────────────────
function ConversationAvatar({ conversation }: { conversation: ConversationDTO }) {
  if (conversation.type === 'group') {
    return (
      <div className="relative h-12 w-12 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center text-primary-foreground ring-2 ring-background">
        <Users className="h-6 w-6" />
      </div>
    )
  }
  const other = conversation.members[0]
  if (!other) {
    return (
      <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
        <MessageSquare className="h-5 w-5 text-muted-foreground" />
      </div>
    )
  }
  return <UserAvatar username={other.username} displayName={other.displayName} avatarUrl={other.avatarUrl} verified={other.verified} size="lg" showVerified={false} />
}

export function displayConversationName(c: ConversationDTO): string {
  if (c.type === 'group') return c.name || 'Grup tanpa nama'
  const other = c.members[0]
  if (!other) return 'Percakapan'
  return other.displayName || `@${other.username}`
}

// ───────────────────────────────────────────────
// New Message dialog (search users + start conversation)
// ───────────────────────────────────────────────
function NewMessageButton({ onCreated }: { onCreated: (c: ConversationDTO) => void }) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [searching, setSearching] = useState(false)
  const [results, setResults] = useState<ProfileDTO[]>([])
  const [creatingId, setCreatingId] = useState<string | null>(null)

  // Debounced user search via /api/search?type=users
  useEffect(() => {
    if (!open) return
    const t = q.trim()
    if (!t) {
      setResults([])
      return
    }
    setSearching(true)
    const id = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?type=users&q=${encodeURIComponent(t)}`)
        if (!res.ok) throw new Error('Gagal mencari pengguna')
        const json = await res.json()
        setResults(json.users ?? [])
      } catch (e: any) {
        toast.error(e.message || 'Gagal mencari pengguna')
      } finally {
        setSearching(false)
      }
    }, 300)
    return () => clearTimeout(id)
  }, [q, open])

  const startWith = async (user: ProfileDTO) => {
    setCreatingId(user.id)
    try {
      const res = await apiPost<{ conversation: ConversationDTO }>('/api/conversations', {
        participantId: user.id,
      })
      toast.success(`Memulai percakapan dengan @${user.username}`)
      setOpen(false)
      setQ('')
      setResults([])
      onCreated(res.conversation)
    } catch (e: any) {
      toast.error(e.message || 'Gagal membuat percakapan')
    } finally {
      setCreatingId(null)
    }
  }

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="rounded-full"
        onClick={() => setOpen(true)}
        aria-label="Pesan baru"
      >
        <PenSquare className="h-5 w-5" />
      </Button>
      <Dialog open={open} onOpenChange={(v) => {
        setOpen(v)
        if (!v) {
          setQ('')
          setResults([])
        }
      }}>
        <DialogContent className="max-w-md p-0 gap-0 overflow-hidden">
          <DialogHeader className="px-4 pt-4 pb-3 border-b border-border">
            <DialogTitle>Pesan baru</DialogTitle>
            <DialogDescription className="sr-only">Cari pengguna untuk mulai mengobrol</DialogDescription>
          </DialogHeader>
          <div className="p-3 border-b border-border">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Cari nama atau @username..."
                className="pl-9 rounded-full bg-muted border-transparent focus-visible:bg-background focus-visible:border-primary"
              />
            </div>
          </div>
          <div className="max-h-80 overflow-y-auto">
            {searching ? (
              <div className="py-6">
                <LoadingState message="Mencari pengguna..." />
              </div>
            ) : results.length === 0 ? (
              <div className="py-10 text-center text-sm text-muted-foreground px-4">
                {q.trim() ? 'Tidak ada pengguna yang cocok.' : 'Ketik nama atau @username untuk mencari.'}
              </div>
            ) : (
              <ul>
                {results.map((u) => (
                  <li key={u.id}>
                    <button
                      disabled={creatingId === u.id}
                      onClick={() => startWith(u)}
                      className="w-full text-left px-4 py-3 hover:bg-muted/60 transition-colors flex items-center gap-3 disabled:opacity-60"
                    >
                      <UserAvatar
                        username={u.username}
                        displayName={u.displayName}
                        avatarUrl={u.avatarUrl}
                        verified={u.verified}
                        size="md"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-[15px] truncate">{u.displayName}</div>
                        <div className="text-sm text-muted-foreground truncate">@{u.username}</div>
                      </div>
                      {creatingId === u.id ? (
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      ) : (
                        <span className="text-xs text-primary font-medium">Mulai</span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <DialogClose asChild>
            <button
              className="absolute right-3 top-3 p-1 rounded-full hover:bg-muted"
              aria-label="Tutup"
            >
              <X className="h-4 w-4" />
            </button>
          </DialogClose>
        </DialogContent>
      </Dialog>
    </>
  )
}

// ───────────────────────────────────────────────
// Chat window (right pane)
// ───────────────────────────────────────────────
function ChatWindow({
  conversationId,
  onBack,
  onConversationChanged,
}: {
  conversationId: string
  onBack: () => void
  onConversationChanged: () => void
}) {
  const user = useAuthStore((s) => s.user)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [draft, setDraft] = useState('')
  const [typingUserIds, setTypingUserIds] = useState<Set<string>>(new Set())
  const [members, setMembers] = useState<AuthorDTO[]>([])
  const [convMeta, setConvMeta] = useState<ConversationDTO | null>(null)

  // Track which conversation is currently mounted — guards against race
  // conditions when switching conversations quickly.
  const mountedConvRef = useRef<string>(conversationId)
  useEffect(() => {
    mountedConvRef.current = conversationId
  }, [conversationId])

  const scrollRef = useRef<HTMLDivElement | null>(null)
  const bottomRef = useRef<HTMLDivElement | null>(null)

  // ── Load conversation meta + messages ────────
  const loadAll = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [convRes, msgRes] = await Promise.all([
        fetch(`/api/conversations/${conversationId}`).then((r) => r.json()),
        fetch(`/api/conversations/${conversationId}/messages?limit=50`).then((r) => r.json()),
      ])
      if (mountedConvRef.current !== conversationId) return
      if (convRes.error) throw new Error(convRes.error)
      if (msgRes.error) throw new Error(msgRes.error)
      setConvMeta(convRes.conversation ?? null)
      setMembers((convRes.conversation?.members ?? []) as AuthorDTO[])
      setMessages((msgRes.messages ?? []) as ChatMessage[])
    } catch (e: any) {
      if (mountedConvRef.current !== conversationId) return
      setError(e.message || 'Gagal memuat percakapan')
    } finally {
      if (mountedConvRef.current === conversationId) setLoading(false)
    }
  }, [conversationId])

  useEffect(() => {
    loadAll()
  }, [loadAll])

  // Mark as read on open / when new messages arrive while window is open.
  const markRead = useCallback(async () => {
    try {
      await apiPost(`/api/conversations/${conversationId}/read`)
      onConversationChanged()
      // Tell other members via socket so they can clear their unread badge
      socketMarkReadRef.current?.(conversationId, memberIdsRef.current)
    } catch {
      /* ignore */
    }
  }, [conversationId, onConversationChanged])

  useEffect(() => {
    if (!loading && messages.length >= 0) markRead()
  }, [loading, conversationId, markRead])

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages.length])

  // ── Recipient ids for socket fan-out ────────
  const memberIdsRef = useRef<string[]>([])
  useEffect(() => {
    memberIdsRef.current = members.map((m) => m.id)
  }, [members])

  // ── Socket connection ────────────────────────
  const onMessage = useCallback((payload: IncomingMessagePayload) => {
    if (payload.conversationId !== mountedConvRef.current) {
      // Different conversation → just trigger a list refresh for unread badges
      onConversationChanged()
      return
    }
    setMessages((prev) => {
      if (prev.some((m) => m.id === payload.message.id)) return prev
      return [...prev, payload.message]
    })
    // Mark read since user is viewing this conversation
    markRead()
  }, [markRead, onConversationChanged])

  const onTyping = useCallback((payload: { conversationId: string; userId: string; isTyping: boolean }) => {
    if (payload.conversationId !== mountedConvRef.current) return
    setTypingUserIds((prev) => {
      const next = new Set(prev)
      if (payload.isTyping) next.add(payload.userId)
      else next.delete(payload.userId)
      return next
    })
  }, [])

  const onRead = useCallback((_payload: { conversationId: string }) => {
    // Could clear a "delivered" indicator — currently no-op
  }, [])

  const { connected, sendMessage, sendTyping, markRead: socketMarkRead } = useChatSocket({
    userId: user?.id,
    username: user?.username,
    callbacks: { onMessage, onTyping, onRead },
  })

  // Stash socket helpers in refs so markRead above can call them without
  // creating a stale-closure dependency cycle.
  const socketMarkReadRef = useRef<typeof socketMarkRead | null>(null)
  socketMarkReadRef.current = socketMarkRead

  // ── Send message ─────────────────────────────
  const handleSend = async () => {
    const content = draft.trim()
    if (!content || sending) return
    setSending(true)
    setDraft('')
    try {
      const res = await apiPost<{ message: ChatMessage }>(
        `/api/conversations/${conversationId}/messages`,
        { content }
      )
      setMessages((prev) => [...prev, res.message])
      // Relay to other members via socket
      sendMessage(conversationId, res.message, memberIdsRef.current)
      // Stop typing indicator on our side
      sendTyping(conversationId, memberIdsRef.current, false)
      onConversationChanged()
      // Scroll to bottom after send
      requestAnimationFrame(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }))
    } catch (e: any) {
      toast.error(e.message || 'Gagal mengirim pesan')
      setDraft(content) // restore draft on failure
    } finally {
      setSending(false)
    }
  }

  // ── Typing indicator ────────────────────────
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const onDraftChange = (v: string) => {
    setDraft(v)
    if (!connected) return
    sendTyping(conversationId, memberIdsRef.current, true)
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
    typingTimeoutRef.current = setTimeout(() => {
      sendTyping(conversationId, memberIdsRef.current, false)
    }, 2000)
  }

  // ── Keyboard ────────────────────────────────
  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // ── Render ──────────────────────────────────
  if (loading && messages.length === 0) {
    return (
      <div className="flex-1 flex flex-col">
        <ChatHeader
          conversation={convMeta}
          onBack={onBack}
          connected={connected}
        />
        <div className="flex-1"><LoadingState message="Memuat pesan..." /></div>
      </div>
    )
  }
  if (error) {
    return (
      <div className="flex-1 flex flex-col">
        <ChatHeader conversation={convMeta} onBack={onBack} connected={connected} />
        <ErrorState message={error} onRetry={loadAll} />
      </div>
    )
  }

  const other = members[0]
  const title = convMeta ? displayConversationName(convMeta) : 'Percakapan'

  return (
    <div className="flex-1 flex flex-col h-full">
      <ChatHeader conversation={convMeta} onBack={onBack} connected={connected} />

      {/* Messages list */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-4 space-y-1"
      >
        {messages.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              {convMeta?.type === 'group' ? (
                <Users className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              ) : (
                other && (
                  <UserAvatar
                    username={other.username}
                    displayName={other.displayName}
                    avatarUrl={other.avatarUrl}
                    verified={other.verified}
                    size="xl"
                  />
                )
              )}
              <p className="font-semibold mt-3">{title}</p>
              <p className="text-sm text-muted-foreground mt-1 max-w-xs">
                {convMeta?.type === 'group'
                  ? 'Belum ada pesan di grup ini. Sapa anggota lain untuk memulai.'
                  : 'Belum ada pesan. Sapa untuk memulai percakapan!'}
              </p>
            </div>
          </div>
        ) : (
          <>
            {messages.map((m, i) => {
              const mine = m.senderId === user?.id
              const prev = messages[i - 1]
              const showSender = !mine && convMeta?.type === 'group' && (!prev || prev.senderId !== m.senderId)
              return (
                <MessageBubble
                  key={m.id}
                  message={m}
                  mine={mine}
                  showSender={showSender}
                  sender={m.sender ?? members.find((mm) => mm.id === m.senderId) ?? undefined}
                />
              )
            })}
            <div ref={bottomRef} />
          </>
        )}
      </div>

      {/* Typing indicator */}
      {typingUserIds.size > 0 && (
        <div className="px-4 pb-1 text-xs text-muted-foreground flex items-center gap-1">
          <span className="flex gap-0.5">
            <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/70 animate-bounce [animation-delay:-0.3s]" />
            <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/70 animate-bounce [animation-delay:-0.15s]" />
            <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/70 animate-bounce" />
          </span>
          <span className="ml-1">sedang mengetik...</span>
        </div>
      )}

      {/* Composer */}
      <div className="border-t border-border p-3 flex items-end gap-2 bg-background">
        <Textarea
          value={draft}
          onChange={(e) => onDraftChange(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Tulis pesan..."
          rows={1}
          className="resize-none max-h-32 min-h-[40px] rounded-2xl bg-muted/50 border-transparent focus-visible:bg-background focus-visible:border-primary"
          style={{ height: 'auto' }}
        />
        <Button
          onClick={handleSend}
          disabled={!draft.trim() || sending}
          size="icon"
          className="rounded-full h-10 w-10 shrink-0"
          aria-label="Kirim"
        >
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  )
}

// ───────────────────────────────────────────────
// Chat header
// ───────────────────────────────────────────────
function ChatHeader({
  conversation,
  onBack,
  connected,
}: {
  conversation: ConversationDTO | null
  onBack: () => void
  connected: boolean
}) {
  const { navigate } = useViewStore()
  const other = conversation?.members?.[0]

  return (
    <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-xl border-b border-border">
      <div className="flex items-center gap-3 px-4 h-14">
        <button
          onClick={onBack}
          className="md:hidden p-1.5 -ml-1.5 rounded-full hover:bg-muted transition-colors"
          aria-label="Kembali"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>

        {conversation?.type === 'group' ? (
          <div className="relative h-9 w-9 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center text-primary-foreground">
            <Users className="h-5 w-5" />
          </div>
        ) : other ? (
          <button
            onClick={() => navigate('profile', { profileUsername: other.username })}
            className="shrink-0"
            aria-label="Lihat profil"
          >
            <UserAvatar
              username={other.username}
              displayName={other.displayName}
              avatarUrl={other.avatarUrl}
              verified={other.verified}
              size="md"
              showVerified={false}
            />
          </button>
        ) : null}

        <div className="flex-1 min-w-0">
          <button
            onClick={() => other && navigate('profile', { profileUsername: other.username })}
            className="block max-w-full text-left"
            disabled={!other}
          >
            <h2 className="font-semibold truncate">{conversation ? displayConversationName(conversation) : 'Percakapan'}</h2>
          </button>
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            {conversation?.type === 'group' ? (
              <>{conversation?.members?.length ?? 0} anggota</>
            ) : (
              <>
                <span
                  className={cn(
                    'inline-block h-2 w-2 rounded-full',
                    connected ? 'bg-emerald-500' : 'bg-muted-foreground/40'
                  )}
                />
                {connected ? 'Online' : 'Offline'}
              </>
            )}
          </p>
        </div>
      </div>
    </header>
  )
}

// ───────────────────────────────────────────────
// Message bubble
// ───────────────────────────────────────────────
function MessageBubble({
  message,
  mine,
  showSender,
  sender,
}: {
  message: ChatMessage
  mine: boolean
  showSender: boolean
  sender?: AuthorDTO
}) {
  const { navigate } = useViewStore()
  const time = new Date(message.createdAt).toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
  })

  return (
    <div className={cn('flex gap-2 py-1', mine ? 'justify-end' : 'justify-start')}>
      {!mine && (
        <div className="self-end mb-1 shrink-0">
          {sender && (
            <button
              onClick={() => navigate('profile', { profileUsername: sender.username })}
              aria-label={`Lihat profil ${sender.displayName}`}
            >
              <UserAvatar
                username={sender.username}
                displayName={sender.displayName}
                avatarUrl={sender.avatarUrl}
                verified={sender.verified}
                size="sm"
                showVerified={false}
              />
            </button>
          )}
        </div>
      )}
      <div className={cn('max-w-[75%] md:max-w-[60%] flex flex-col', mine ? 'items-end' : 'items-start')}>
        {showSender && sender && (
          <span className="text-xs font-medium text-muted-foreground ml-1 mb-0.5">
            {sender.displayName || `@${sender.username}`}
          </span>
        )}
        <div
          className={cn(
            'px-3 py-2 rounded-2xl text-[15px] break-words whitespace-pre-wrap',
            mine
              ? 'bg-primary text-primary-foreground rounded-br-md'
              : 'bg-muted text-foreground rounded-bl-md'
          )}
        >
          {message.content}
        </div>
        <span
          className={cn(
            'text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1',
            mine ? 'mr-1' : 'ml-1'
          )}
        >
          {time}
          {mine && <CheckCheck className="h-3 w-3" />}
        </span>
      </div>
    </div>
  )
}
