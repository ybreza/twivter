// Shared serialization helpers — convert Prisma rows to DTOs the frontend expects.
// All subagents MUST use these to keep API responses consistent.
import { db } from './db'
import type {
  PostDTO,
  ProfileDTO,
  AuthorDTO,
  NotificationDTO,
  ConversationDTO,
  MessageDTO,
  CommunityDTO,
} from './types'

// ── Author ────────────────────────────────────
export function toAuthor(user: {
  id: string
  username: string
  displayName: string
  avatarUrl: string | null
  verified: boolean
}): AuthorDTO {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    verified: user.verified,
  }
}

// ── Post ──────────────────────────────────────
export async function serializePost(
  post: any,
  currentUserId?: string | null
): Promise<PostDTO> {
  const [likeCount, commentCount, repostCount, bookmarkCount] = await Promise.all([
    db.like.count({ where: { postId: post.id } }),
    db.post.count({ where: { replyToId: post.id } }),
    db.repost.count({ where: { postId: post.id } }),
    db.bookmark.count({ where: { postId: post.id } }),
  ])

  let liked = false
  let bookmarked = false
  let reposted = false
  if (currentUserId) {
    ;[liked, bookmarked, reposted] = await Promise.all([
      db.like.findUnique({ where: { postId_userId: { postId: post.id, userId: currentUserId } } }).then(Boolean),
      db.bookmark.findUnique({ where: { postId_userId: { postId: post.id, userId: currentUserId } } }).then(Boolean),
      db.repost.findUnique({ where: { postId_userId: { postId: post.id, userId: currentUserId } } }).then(Boolean),
    ])
  }

  let quotePost: PostDTO | null = null
  if (post.quotePost) {
    quotePost = await serializePost(post.quotePost, currentUserId)
  }

  let replyTo: PostDTO | null = null
  if (post.replyTo) {
    replyTo = await serializePost(post.replyTo, currentUserId)
  }

  return {
    id: post.id,
    content: post.content,
    createdAt: post.createdAt instanceof Date ? post.createdAt.toISOString() : post.createdAt,
    author: toAuthor(post.author),
    media: (post.media ?? []).map((m: any) => ({
      id: m.id,
      url: m.url,
      type: m.type,
      order: m.order,
    })),
    replyToId: post.replyToId ?? null,
    quotePostId: post.quotePostId ?? null,
    likeCount,
    commentCount,
    repostCount,
    bookmarkCount,
    liked,
    bookmarked,
    reposted,
    quotePost,
    replyTo,
  }
}

// Standard post include for fetching with relations
export const POST_INCLUDE = {
  author: {
    select: {
      id: true,
      username: true,
      displayName: true,
      avatarUrl: true,
      verified: true,
    },
  },
  media: { orderBy: { order: 'asc' as const } },
  quotePost: {
    include: {
      author: {
        select: { id: true, username: true, displayName: true, avatarUrl: true, verified: true },
      },
      media: { orderBy: { order: 'asc' as const } },
    },
  },
  replyTo: {
    include: {
      author: {
        select: { id: true, username: true, displayName: true, avatarUrl: true, verified: true },
      },
      media: { orderBy: { order: 'asc' as const } },
    },
  },
} as const

// ── Profile ───────────────────────────────────
export async function serializeProfile(
  user: any,
  currentUserId?: string | null
): Promise<ProfileDTO> {
  const [followersCount, followingCount, postsCount] = await Promise.all([
    db.follow.count({ where: { followingId: user.id } }),
    db.follow.count({ where: { followerId: user.id } }),
    db.post.count({ where: { authorId: user.id, replyToId: null } }),
  ])

  let isFollowing = false
  if (currentUserId && currentUserId !== user.id) {
    isFollowing = await db.follow
      .findUnique({
        where: {
          followerId_followingId: { followerId: currentUserId, followingId: user.id },
        },
      })
      .then(Boolean)
  }

  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    bio: user.bio ?? null,
    website: user.website ?? null,
    location: user.location ?? null,
    avatarUrl: user.avatarUrl ?? null,
    coverUrl: user.coverUrl ?? null,
    verified: user.verified,
    role: user.role,
    createdAt: user.createdAt instanceof Date ? user.createdAt.toISOString() : user.createdAt,
    followersCount,
    followingCount,
    postsCount,
    isFollowing,
    isSelf: currentUserId === user.id,
  }
}

// ── Notification ──────────────────────────────
export async function serializeNotification(n: any): Promise<NotificationDTO> {
  return {
    id: n.id,
    type: n.type,
    read: n.read,
    createdAt: n.createdAt instanceof Date ? n.createdAt.toISOString() : n.createdAt,
    actor: toAuthor(n.actor),
    post: n.postId
      ? { id: n.post.id, content: n.post.content }
      : null,
  }
}

export const NOTIFICATION_INCLUDE = {
  actor: {
    select: { id: true, username: true, displayName: true, avatarUrl: true, verified: true },
  },
  post: { select: { id: true, content: true } },
} as const

// ── Conversation ──────────────────────────────
export async function serializeConversation(
  conv: any,
  currentUserId: string
): Promise<ConversationDTO> {
  const lastMessage = conv.messages?.[0] ?? null
  // unread = messages after my lastReadAt, not sent by me
  const myMembership = conv.members?.find((m: any) => m.userId === currentUserId)
  let unreadCount = 0
  if (myMembership && conv.messages) {
    unreadCount = conv.messages.filter(
      (m: any) =>
        m.senderId !== currentUserId &&
        new Date(m.createdAt) > new Date(myMembership.lastReadAt)
    ).length
  }

  return {
    id: conv.id,
    type: conv.type,
    name: conv.name ?? null,
    lastMessage: lastMessage
      ? {
          id: lastMessage.id,
          conversationId: conv.id,
          senderId: lastMessage.senderId,
          content: lastMessage.content,
          createdAt: lastMessage.createdAt instanceof Date ? lastMessage.createdAt.toISOString() : lastMessage.createdAt,
        }
      : null,
    members: (conv.members ?? [])
      .filter((m: any) => m.userId !== currentUserId)
      .map((m: any) => toAuthor(m.user)),
    unreadCount,
  }
}

export const CONVERSATION_INCLUDE = {
  members: {
    include: {
      user: {
        select: { id: true, username: true, displayName: true, avatarUrl: true, verified: true },
      },
    },
  },
  messages: {
    orderBy: { createdAt: 'desc' as const },
    take: 1,
  },
} as const

// ── Message ───────────────────────────────────
export function serializeMessage(m: any): MessageDTO {
  return {
    id: m.id,
    conversationId: m.conversationId,
    senderId: m.senderId,
    content: m.content,
    createdAt: m.createdAt instanceof Date ? m.createdAt.toISOString() : m.createdAt,
  }
}

// ── Community ─────────────────────────────────
export async function serializeCommunity(
  c: any,
  currentUserId?: string | null
): Promise<CommunityDTO> {
  const membersCount = await db.communityMember.count({ where: { communityId: c.id } })
  let isMember = false
  let role: string | null = null
  if (currentUserId) {
    const membership = await db.communityMember.findUnique({
      where: { communityId_userId: { communityId: c.id, userId: currentUserId } },
    })
    if (membership) {
      isMember = true
      role = membership.role
    }
  }
  return {
    id: c.id,
    name: c.name,
    slug: c.slug,
    description: c.description ?? null,
    coverUrl: c.coverUrl ?? null,
    owner: toAuthor(c.owner),
    membersCount,
    isMember,
    role,
    createdAt: c.createdAt instanceof Date ? c.createdAt.toISOString() : c.createdAt,
  }
}

export const COMMUNITY_INCLUDE = {
  owner: {
    select: { id: true, username: true, displayName: true, avatarUrl: true, verified: true },
  },
} as const
