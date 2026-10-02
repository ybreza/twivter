'use client'

import { useEffect } from 'react'
import { useAuthStore, useViewStore } from '@/stores/app-store'
import { AppShell } from '@/components/layout/app-shell'
import { TwivterLogo } from '@/components/twivter-logo'
import { Loader2 } from 'lucide-react'

// Views
import { LandingView } from '@/components/views/landing-view'
import { LoginView } from '@/components/views/login-view'
import { RegisterView } from '@/components/views/register-view'
import { OnboardingView } from '@/components/views/onboarding-view'
import { HomeView } from '@/components/views/home-view'
import { ExploreView } from '@/components/views/explore-view'
import { NotificationsView } from '@/components/views/notifications-view'
import { MessagesView } from '@/components/views/messages-view'
import { BookmarksView } from '@/components/views/bookmarks-view'
import { CommunitiesView } from '@/components/views/communities-view'
import { SettingsView } from '@/components/views/settings-view'
import { AdminView } from '@/components/views/admin-view'
import { ProfileView } from '@/components/views/profile-view'
import { PostDetailView } from '@/components/views/post-detail-view'
import { TrendingSidebar } from '@/components/layout/trending-sidebar'

export default function Page() {
  const user = useAuthStore((s) => s.user)
  const loading = useAuthStore((s) => s.loading)
  const view = useViewStore((s) => s.view)

  // If user becomes unauthenticated while in an app view, reset to landing
  useEffect(() => {
    if (!loading && !user) {
      const current = useViewStore.getState().view
      if (current !== 'landing' && current !== 'login' && current !== 'register') {
        useViewStore.getState().navigate('landing')
      }
    }
  }, [loading, user])

  // ── Deep link: /?post=<id> ─────────────────────
  // `PostCard`'s share button produces this URL. The SPA is the only reader of
  // the router, so the param is consumed here — on mount and on popstate — and
  // then stripped from the address bar.
  useEffect(() => {
    if (loading || !user) return

    const openFromUrl = () => {
      const id = new URLSearchParams(window.location.search).get('post')
      if (!id) return
      useViewStore.getState().navigate('post-detail', { postId: id })
      const url = `${window.location.pathname}${window.location.hash}`
      window.history.replaceState(null, '', url)
    }

    openFromUrl()
    window.addEventListener('popstate', openFromUrl)
    return () => window.removeEventListener('popstate', openFromUrl)
  }, [loading, user])

  // ── Loading state ─────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background">
        <TwivterLogo size={64} className="animate-pulse" />
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Memuat Twivter...</span>
        </div>
      </div>
    )
  }

  // ── Unauthenticated flows ─────────────────────
  if (!user) {
    if (view === 'login') return <LoginView />
    if (view === 'register') return <RegisterView />
    return <LandingView />
  }

  // ── Authenticated but not onboarded ───────────
  if (!user.onboarded) {
    return <OnboardingView />
  }

  // ── Authenticated app views ───────────────────
  const showRightSidebar = view === 'home' || view === 'explore'
  const rightSidebar = showRightSidebar ? <TrendingSidebar /> : undefined

  return (
    <AppShell rightSidebar={rightSidebar}>
      <ViewRenderer view={view} />
    </AppShell>
  )
}

function ViewRenderer({ view }: { view: string }) {
  switch (view) {
    case 'home':
      return <HomeView />
    case 'explore':
      return <ExploreView />
    case 'notifications':
      return <NotificationsView />
    case 'messages':
      return <MessagesView />
    case 'bookmarks':
      return <BookmarksView />
    case 'communities':
      return <CommunitiesView />
    case 'settings':
      return <SettingsView />
    case 'admin':
      return <AdminView />
    case 'profile':
      return <ProfileView />
    case 'post-detail':
      return <PostDetailView />
    default:
      return <HomeView />
  }
}
