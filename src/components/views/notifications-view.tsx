'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  Bell,
  Heart,
  MessageCircle,
  Repeat2,
  UserPlus,
  AtSign,
  Mail,
  CheckCheck,
  type LucideIcon,
} from 'lucide-react'
import { useViewStore } from '@/stores/app-store'
import { useApi, apiPost } from '@/lib/hooks'
import { ViewHeader, EmptyState, LoadingState, ErrorState } from '@/components/shared-states'
import { UserAvatar } from '@/components/user-avatar'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { timeAgo } from '@/lib/api'
import type { NotificationDTO } from '@/lib/types'

interface NotifResponse {
  notifications: NotificationDTO[]
  unreadCount: number
  nextCursor: string | null
}

const NOTIF_META: Record<string, { icon: LucideIcon; color: string; verb: string }> = {
  like: { icon: Heart, color: 'text-rose-500', verb: 'menyukai post Anda' },
  comment: { icon: MessageCircle, color: 'text-sky-500', verb: 'membalas post Anda' },
  repost: { icon: Repeat2, color: 'text-emerald-500', verb: 'merepost post Anda' },
  follow: { icon: UserPlus, color: 'text-primary', verb: 'mulai mengikuti Anda' },
  mention: { icon: AtSign, color: 'text-amber-500', verb: 'menyebut Anda' },
  message: { icon: Mail, color: 'text-purple-500', verb: 'mengirim pesan' },
}

export function NotificationsView() {
  const { data, loading, error, refetch, setData } = useApi<NotifResponse>('/api/notifications', {})

  // Mark all as read on mount (after first render — fire and forget)
  const markAllRead = useCallback(async () => {
    try {
      await apiPost('/api/notifications/read', {})
      // Optimistically update local state to show all as read
      setData((prev) =>
        prev
          ? {
              ...prev,
              notifications: prev.notifications.map((n) => ({ ...n, read: true })),
              unreadCount: 0,
            }
          : prev
      )
    } catch {
      /* ignore — best-effort */
    }
  }, [setData])

  useEffect(() => {
    if (data && data.unreadCount > 0) {
      // Fire mark-all-read after 1s delay (per spec) so the user briefly sees
      // unread indicators before they flip to read.
      const t = setTimeout(() => {
        markAllRead()
      }, 1000)
      return () => clearTimeout(t)
    }
  }, [data, markAllRead])

  return (
    <>
      <ViewHeader
        title="Notifications"
        subtitle={
          data && data.unreadCount > 0 ? `${data.unreadCount} belum dibaca` : 'Semua sudah dibaca'
        }
        rightSlot={
          data && data.unreadCount > 0 ? (
            <Button
              variant="ghost"
              size="sm"
              className="rounded-full text-primary hover:text-primary"
              onClick={markAllRead}
            >
              <CheckCheck className="h-4 w-4 mr-1" /> Tandai semua dibaca
            </Button>
          ) : null
        }
      />

      {loading ? (
        <LoadingState message="Memuat notifikasi..." />
      ) : error ? (
        <ErrorState message={error} onRetry={refetch} />
      ) : !data || data.notifications.length === 0 ? (
        <EmptyState
          icon={Bell}
          title="Belum ada notifikasi"
          description="Mulai interaksi untuk mendapat notifikasi! Like, komentar, repost, dan follow akan memicu notifikasi di sini."
        />
      ) : (
        <ul className="divide-y divide-border">
          {data.notifications.map((n) => (
            <NotificationItem key={n.id} notif={n} />
          ))}
        </ul>
      )}
    </>
  )
}

function NotificationItem({ notif }: { notif: NotificationDTO }) {
  const { navigate } = useViewStore()
  const meta = NOTIF_META[notif.type] ?? { icon: Bell, color: 'text-muted-foreground', verb: 'notifikasi' }
  const Icon = meta.icon

  const handleClick = () => {
    if (notif.post) {
      navigate('post-detail', { postId: notif.post.id })
    } else {
      navigate('profile', { profileUsername: notif.actor.username })
    }
  }

  return (
    <li
      onClick={handleClick}
      className={cn(
        'relative px-4 py-3 hover:bg-muted/30 transition-colors cursor-pointer flex gap-3',
        !notif.read && 'bg-primary/5'
      )}
    >
      {/* Icon + unread dot */}
      <div className="shrink-0 pt-1">
        <div className={cn('p-1.5 rounded-full bg-muted/60', meta.color)}>
          <Icon className="h-4 w-4" />
        </div>
      </div>

      <div className="flex-1 min-w-0">
        {/* Avatar */}
        <div className="mb-1.5">
          <UserAvatar
            username={notif.actor.username}
            displayName={notif.actor.displayName}
            avatarUrl={notif.actor.avatarUrl}
            verified={notif.actor.verified}
            size="sm"
          />
        </div>
        <div className="text-sm">
          <span className="font-semibold">{notif.actor.displayName}</span>{' '}
          <span className="text-muted-foreground">{meta.verb}</span>
        </div>
        <div className="text-xs text-muted-foreground mt-0.5">{timeAgo(notif.createdAt)}</div>
        {notif.post && (
          <p className="mt-1.5 text-xs text-muted-foreground line-clamp-2 border-l-2 border-border pl-2 italic">
            {notif.post.content}
          </p>
        )}
      </div>

      {/* Unread blue dot */}
      {!notif.read && (
        <span
          className="absolute top-3 right-3 h-2 w-2 rounded-full bg-primary"
          aria-label="Belum dibaca"
        />
      )}
    </li>
  )
}
