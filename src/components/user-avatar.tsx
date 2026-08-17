'use client'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { cn, getInitials } from '@/lib/utils'
import { BadgeCheck } from 'lucide-react'

interface UserAvatarProps {
  username: string
  displayName: string
  avatarUrl: string | null
  verified?: boolean
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl'
  className?: string
  showVerified?: boolean
}

const sizeMap = {
  xs: 'h-6 w-6 text-[10px]',
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-12 w-12 text-base',
  xl: 'h-16 w-16 text-lg',
  '2xl': 'h-32 w-32 text-3xl',
}

const badgeSizeMap = {
  xs: 'h-3 w-3',
  sm: 'h-3.5 w-3.5',
  md: 'h-4 w-4',
  lg: 'h-5 w-5',
  xl: 'h-6 w-6',
  '2xl': 'h-8 w-8',
}

// Deterministic color from username (for fallback when no avatar)
const colors = [
  'bg-blue-500',
  'bg-purple-500',
  'bg-pink-500',
  'bg-emerald-500',
  'bg-amber-500',
  'bg-cyan-500',
  'bg-rose-500',
  'bg-indigo-500',
  'bg-teal-500',
  'bg-orange-500',
]
function colorFor(username: string) {
  let hash = 0
  for (let i = 0; i < username.length; i++) hash = username.charCodeAt(i) + ((hash << 5) - hash)
  return colors[Math.abs(hash) % colors.length]
}

export function UserAvatar({
  username,
  displayName,
  avatarUrl,
  verified = false,
  size = 'md',
  className,
  showVerified = true,
}: UserAvatarProps) {
  return (
    <div className={cn('relative inline-block shrink-0', className)}>
      <Avatar className={cn(sizeMap[size], 'ring-2 ring-background')}>
        {avatarUrl ? (
          <AvatarImage src={avatarUrl} alt={displayName} />
        ) : null}
        <AvatarFallback className={cn(colorFor(username), 'text-white font-semibold')}>
          {getInitials(displayName || username)}
        </AvatarFallback>
      </Avatar>
      {verified && showVerified && size !== 'xs' && size !== 'sm' && (
        <span
          className={cn(
            'absolute -bottom-0.5 -right-0.5 rounded-full bg-primary text-primary-foreground flex items-center justify-center ring-2 ring-background',
            badgeSizeMap[size]
          )}
        >
          <BadgeCheck className="h-full w-full" />
        </span>
      )}
    </div>
  )
}
