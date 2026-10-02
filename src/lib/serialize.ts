/**
 * Pure DTO builders.
 *
 * The previous `serializePost`/`serializeProfile` ran 7 database queries *per
 * object*, so a 20-post feed cost ~140 round-trips — and `/api/explore` and
 * `/api/search` amplified that further. These functions are now pure: the
 * repository layer in `src/lib/data/*` loads rows and aggregates in bulk, then
 * hands the plain data to the builders below.
 */
import type {
  AuthorDTO,
  PostDTO,
  PostMediaDTO,
  ProfileDTO,
  NotificationDTO,
  ConversationDTO,
  MessageDTO,
  CommunityDTO,
} from './types'

// ── Author ───────────────────────────────────────────────────────────────────

export interface AuthorRow {
  id: string
  username: string
  displayName: string
  avatarUrl: string | null
  verified: number | boolean
}

export function toAuthor(user: AuthorRow): AuthorDTO {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl ?? null,
    verified: user.verified === 1 || user.verified === true,
  }
}

// ── Post ─────────────────────────────────────────────────────────────────────

export interface MediaRow {
  id: string
  postId: string
  url: string
  type: string
  ord: number
}

/** A post row joined with its author, before counts are resolved. */
export interface PostRecord {
  id: string
  authorId: string
  content: string
  replyToId: string | null
  quotePostId: string | null
  createdAt: string
  author: AuthorRow
  media: MediaRow[]
}

/** Per-post counters and the current viewer's interaction flags. */
export interface PostAggregates {
  likeCount: number
  commentCount: number
  repostCount: number
  bookmarkCount: number
  liked: boolean
  bookmarked: boolean
  reposted: boolean
}

export const EMPTY_POST_AGGREGATES: PostAggregates = {
  likeCount: 0,
  commentCount: 0,
  repostCount: 0,
  bookmarkCount: 0,
  liked: false,
  bookmarked: false,
  reposted: false,
}

function toMedia(rows: MediaRow[] | undefined): PostMediaDTO[] {
  if (!rows || rows.length === 0) return []
  return rows.map((m) => ({ id: m.id, url: m.url, type: m.type, order: m.ord }))
}

export function buildPostDTO(
  record: PostRecord,
  aggregates: Partial<PostAggregates> = {},
  nested?: { quotePost?: PostDTO | null; replyTo?: PostDTO | null },
): PostDTO {
  const agg = { ...EMPTY_POST_AGGREGATES, ...aggregates }
  return {
    id: record.id,
    content: record.content,
    createdAt: record.createdAt,
    author: toAuthor(record.author),
    media: toMedia(record.media),
    replyToId: record.replyToId ?? null,
    quotePostId: record.quotePostId ?? null,
    likeCount: agg.likeCount,
    commentCount: agg.commentCount,
    repostCount: agg.repostCount,
    bookmarkCount: agg.bookmarkCount,
    liked: agg.liked,
    bookmarked: agg.bookmarked,
    reposted: agg.reposted,
    quotePost: nested?.quotePost ?? null,
    replyTo: nested?.replyTo ?? null,
  }
}

// ── Profile ──────────────────────────────────────────────────────────────────

export interface ProfileRow {
  id: string
  username: string
  displayName: string
  bio: string | null
  website: string | null
  location: string | null
  avatarUrl: string | null
  coverUrl: string | null
  verified: number | boolean
  role: string
  createdAt: string
}

export interface ProfileAggregates {
  followersCount: number
  followingCount: number
  postsCount: number
  isFollowing: boolean
  isSelf: boolean
}

export function buildProfileDTO(
  user: ProfileRow,
  aggregates: Partial<ProfileAggregates> = {},
  currentUserId?: string | null,
): ProfileDTO {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    bio: user.bio ?? null,
    website: user.website ?? null,
    location: user.location ?? null,
    avatarUrl: user.avatarUrl ?? null,
    coverUrl: user.coverUrl ?? null,
    verified: user.verified === 1 || user.verified === true,
    role: user.role,
    createdAt: user.createdAt,
    followersCount: aggregates.followersCount ?? 0,
    followingCount: aggregates.followingCount ?? 0,
    postsCount: aggregates.postsCount ?? 0,
    isFollowing: aggregates.isFollowing ?? false,
    isSelf: currentUserId != null && currentUserId === user.id,
  }
}

/** Aggregates for many profiles at once, so profile lists don't N+1. */
export interface ProfileAggregateMap {
  followersCount: Map<string, number>
  followingCount: Map<string, number>
  postsCount: Map<string, number>
  isFollowing: Set<string>
}

export function buildProfileDTOs(
  users: ProfileRow[],
  agg: ProfileAggregateMap,
  currentUserId?: string | null,
): ProfileDTO[] {
  return users.map((user) =>
    buildProfileDTO(
      user,
      {
        followersCount: agg.followersCount.get(user.id) ?? 0,
        followingCount: agg.followingCount.get(user.id) ?? 0,
        postsCount: agg.postsCount.get(user.id) ?? 0,
        isFollowing: agg.isFollowing.has(user.id),
      },
      currentUserId,
    ),
  )
}

// ── Notification ─────────────────────────────────────────────────────────────

export interface NotificationRow {
  id: string
  type: string
  read: number | boolean
  createdAt: string
  actor: AuthorRow
  post: { id: string; content: string } | null
}

export function buildNotificationDTO(n: NotificationRow): NotificationDTO {
  return {
    id: n.id,
    type: n.type,
    read: n.read === 1 || n.read === true,
    createdAt: n.createdAt,
    actor: toAuthor(n.actor),
    // `post` is null when the referenced post was deleted. The old code
    // dereferenced it unconditionally whenever `postId` was set, which turned a
    // single deleted post into a permanent 500 on the whole notifications feed.
    post: n.post ?? null,
  }
}

// ── Conversation ─────────────────────────────────────────────────────────────

export interface ConversationMemberRow {
  userId: string
  lastReadAt: string
  user: AuthorRow
}

export interface ConversationRow {
  id: string
  type: string
  name: string | null
  updatedAt: string
  members: ConversationMemberRow[]
  lastMessage: {
    id: string
    conversationId: string
    senderId: string
    content: string
    createdAt: string
  } | null
  unreadCount: number
}

export function buildConversationDTO(
  conv: ConversationRow,
  currentUserId: string,
): ConversationDTO {
  return {
    id: conv.id,
    type: conv.type,
    name: conv.name ?? null,
    lastMessage: conv.lastMessage ?? null,
    members: conv.members.filter((m) => m.userId !== currentUserId).map((m) => toAuthor(m.user)),
    unreadCount: conv.unreadCount ?? 0,
  }
}

// ── Message ──────────────────────────────────────────────────────────────────

export function buildMessageDTO(m: {
  id: string
  conversationId: string
  senderId: string
  content: string
  createdAt: string
}): MessageDTO {
  return {
    id: m.id,
    conversationId: m.conversationId,
    senderId: m.senderId,
    content: m.content,
    createdAt: m.createdAt,
  }
}

// ── Community ────────────────────────────────────────────────────────────────

export function buildCommunityDTO(
  c: {
    id: string
    name: string
    slug: string
    description: string | null
    coverUrl: string | null
    createdAt: string
    owner: AuthorRow
  },
  membership: { membersCount: number; isMember: boolean; role: string | null } = {
    membersCount: 0,
    isMember: false,
    role: null,
  },
): CommunityDTO {
  return {
    id: c.id,
    name: c.name,
    slug: c.slug,
    description: c.description ?? null,
    coverUrl: c.coverUrl ?? null,
    owner: toAuthor(c.owner),
    membersCount: membership.membersCount ?? 0,
    isMember: membership.isMember ?? false,
    role: membership.role ?? null,
    createdAt: c.createdAt,
  }
}