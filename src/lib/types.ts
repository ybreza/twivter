// Shared API types for Twivter
// These mirror Prisma models but flatten relations for client consumption.

export interface PostMediaDTO {
  id: string
  url: string
  type: string
  order: number
}

export interface AuthorDTO {
  id: string
  username: string
  displayName: string
  avatarUrl: string | null
  verified: boolean
}

export interface PostDTO {
  id: string
  content: string
  createdAt: string
  author: AuthorDTO
  media: PostMediaDTO[]
  replyToId: string | null
  quotePostId: string | null
  // aggregated counts
  likeCount: number
  commentCount: number
  repostCount: number
  bookmarkCount: number
  // interaction flags for the current user
  liked: boolean
  bookmarked: boolean
  reposted: boolean
  // optional quoted post (for quote tweets)
  quotePost?: PostDTO | null
  // optional parent post (when this is a reply)
  replyTo?: PostDTO | null
}

export interface ProfileDTO {
  id: string
  username: string
  displayName: string
  bio: string | null
  website: string | null
  location: string | null
  avatarUrl: string | null
  coverUrl: string | null
  verified: boolean
  role: string
  createdAt: string
  // counts (computed via DB)
  followersCount: number
  followingCount: number
  postsCount: number
  // interaction with current user
  isFollowing: boolean
  isSelf: boolean
}

export interface NotificationDTO {
  id: string
  type: string
  read: boolean
  createdAt: string
  actor: AuthorDTO
  post?: {
    id: string
    content: string
  } | null
}

export interface ConversationDTO {
  id: string
  type: string
  name: string | null
  lastMessage?: MessageDTO | null
  members: AuthorDTO[]
  unreadCount: number
}

export interface MessageDTO {
  id: string
  conversationId: string
  senderId: string
  content: string
  createdAt: string
}

export interface CommunityDTO {
  id: string
  name: string
  slug: string
  description: string | null
  coverUrl: string | null
  owner: AuthorDTO
  membersCount: number
  isMember: boolean
  role: string | null
  createdAt: string
}

export const INTEREST_OPTIONS = [
  'Teknologi', 'AI', 'Bisnis', 'Startup', 'Olahraga', 'Musik', 'Film',
  'Game', 'Travel', 'Kuliner', 'Fashion', 'Sains', 'Crypto',
  'Programming', 'Desain', 'Fotografi', 'Sastra', 'Seni',
] as const

export type InterestOption = (typeof INTEREST_OPTIONS)[number]
