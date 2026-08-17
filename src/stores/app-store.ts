'use client'

import { create } from 'zustand'

// ── Auth Types ────────────────────────────────
export interface CurrentUser {
  id: string
  email: string
  username: string
  displayName: string
  bio: string | null
  website: string | null
  location: string | null
  avatarUrl: string | null
  coverUrl: string | null
  role: string
  verified: boolean
  onboarded: boolean
  interests: string | null
  createdAt: string
}

interface AuthState {
  user: CurrentUser | null
  loading: boolean
  setUser: (user: CurrentUser | null) => void
  setLoading: (loading: boolean) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: true,
  setUser: (user) => set({ user, loading: false }),
  setLoading: (loading) => set({ loading }),
  logout: () => set({ user: null, loading: false }),
}))

// ── View Routing (SPA on /) ───────────────────
export type ViewName =
  | 'landing'
  | 'login'
  | 'register'
  | 'onboarding'
  | 'home'
  | 'explore'
  | 'notifications'
  | 'messages'
  | 'bookmarks'
  | 'communities'
  | 'settings'
  | 'admin'
  | 'profile'
  | 'post-detail'

interface ViewState {
  view: ViewName
  // params for views that need them
  profileUsername: string | null
  postId: string | null
  conversationId: string | null
  searchQuery: string

  navigate: (
    view: ViewName,
    params?: Partial<Pick<ViewState, 'profileUsername' | 'postId' | 'conversationId' | 'searchQuery'>>
  ) => void
  setConversation: (id: string) => void
  setSearchQuery: (q: string) => void
}

export const useViewStore = create<ViewState>((set) => ({
  view: 'home',
  profileUsername: null,
  postId: null,
  conversationId: null,
  searchQuery: '',
  navigate: (view, params) =>
    set({
      view,
      profileUsername: params?.profileUsername ?? null,
      postId: params?.postId ?? null,
      conversationId: params?.conversationId ?? null,
      searchQuery: params?.searchQuery ?? '',
    }),
  setConversation: (id) => set({ conversationId: id }),
  setSearchQuery: (q) => set({ searchQuery: q }),
}))

// ── Theme (light/dark/system) ─────────────────
type Theme = 'light' | 'dark' | 'system'
interface ThemeState {
  theme: Theme
  setTheme: (t: Theme) => void
}
export const useThemeStore = create<ThemeState>((set) => ({
  theme: 'system',
  setTheme: (t) => {
    if (typeof window !== 'undefined') localStorage.setItem('twivter-theme', t)
    set({ theme: t })
    applyTheme(t)
  },
}))

export function applyTheme(theme: Theme) {
  if (typeof window === 'undefined') return
  const root = document.documentElement
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  const isDark = theme === 'dark' || (theme === 'system' && prefersDark)
  root.classList.toggle('dark', isDark)
}
