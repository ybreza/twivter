'use client'

import { cn } from '@/lib/utils'

export function TwivterLogo({ className, size = 32 }: { className?: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn('inline-block', className)}
      aria-label="Twivter"
    >
      <defs>
        <linearGradient id="twivter-logo-grad" x1="0" y1="0" x2="120" y2="120" gradientUnits="userSpaceOnUse">
          <stop stopColor="#3B82F6" />
          <stop offset="1" stopColor="#8B5CF6" />
        </linearGradient>
      </defs>
      <rect width="120" height="120" rx="28" fill="url(#twivter-logo-grad)" />
      <path d="M28 38 L52 72 L52 88 L68 88 L68 72 L92 38 L80 38 L60 64 L40 38 Z" fill="white" />
    </svg>
  )
}

export function TwivterWordmark({ className }: { className?: string }) {
  return (
    <span className={cn('text-gradient-twivter font-bold tracking-tight', className)}>
      Twivter
    </span>
  )
}
