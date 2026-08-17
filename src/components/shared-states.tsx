'use client'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { useViewStore } from '@/stores/app-store'
import { Skeleton } from '@/components/ui/skeleton'

// Sticky header for views (Back button + title)
export function ViewHeader({
  title,
  subtitle,
  showBack,
  children,
  rightSlot,
}: {
  title: string
  subtitle?: string
  showBack?: boolean
  children?: React.ReactNode
  rightSlot?: React.ReactNode
}) {
  const navigate = useViewStore((s) => s.navigate)
  const view = useViewStore((s) => s.view)
  return (
    <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-xl border-b border-border">
      <div className="flex items-center gap-4 px-4 h-14">
        {showBack && (
          <button
            onClick={() => navigate('home')}
            className="p-1.5 rounded-full hover:bg-muted transition-colors"
            aria-label="Kembali"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="font-bold text-lg truncate">{title}</h1>
          {subtitle && <p className="text-xs text-muted-foreground truncate">{subtitle}</p>}
        </div>
        {rightSlot}
      </div>
      {children}
    </header>
  )
}

// Empty state
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ComponentType<{ className?: string }>
  title: string
  description?: string
  action?: { label: string; onClick: () => void }
  className?: string
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center text-center py-16 px-6', className)}>
      {Icon && (
        <div className="mb-4 p-4 rounded-full bg-muted">
          <Icon className="h-8 w-8 text-muted-foreground" />
        </div>
      )}
      <h3 className="text-xl font-bold mb-1">{title}</h3>
      {description && <p className="text-muted-foreground text-sm max-w-sm">{description}</p>}
      {action && (
        <Button onClick={action.onClick} className="mt-4 rounded-full font-semibold">
          {action.label}
        </Button>
      )}
    </div>
  )
}

// Loading state
export function LoadingState({ message }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
      <Loader2 className="h-6 w-6 animate-spin mb-2" />
      <p className="text-sm">{message ?? 'Memuat...'}</p>
    </div>
  )
}

// Error state
export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 px-6">
      <p className="text-destructive font-medium mb-2">Terjadi kesalahan</p>
      <p className="text-muted-foreground text-sm mb-4">{message}</p>
      {onRetry && (
        <Button onClick={onRetry} variant="outline" className="rounded-full">
          Coba lagi
        </Button>
      )}
    </div>
  )
}

// Post card skeleton
export function PostCardSkeleton() {
  return (
    <div className="px-4 py-3 border-b border-border">
      <div className="flex gap-3">
        <Skeleton className="h-10 w-10 rounded-full" />
        <div className="flex-1 space-y-2">
          <div className="flex gap-2">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-3 w-16" />
          </div>
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-4/5" />
          <div className="flex justify-between pt-2">
            <Skeleton className="h-6 w-16" />
            <Skeleton className="h-6 w-16" />
            <Skeleton className="h-6 w-16" />
            <Skeleton className="h-6 w-16" />
          </div>
        </div>
      </div>
    </div>
  )
}

// Feed loading skeleton
export function FeedSkeleton({ count = 5 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <PostCardSkeleton key={i} />
      ))}
    </>
  )
}
