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
export type Theme = 'light' | 'dark' | 'system'

export const THEME_STORAGE_KEY = 'twivter-theme'

function isTheme(value: unknown): value is Theme {
  return value === 'light' || value === 'dark' || value === 'system'
}

interface ThemeState {
  theme: Theme
  setTheme: (t: Theme) => void
  /** Reads the persisted choice. Called from an effect, never during render. */
  hydrate: () => void
}
export const useThemeStore = create<ThemeState>((set) => ({
  theme: 'system',
  setTheme: (t) => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(THEME_STORAGE_KEY, t)
      } catch {
        /* private mode / quota — the choice simply will not persist */
      }
    }
    set({ theme: t })
    applyTheme(t)
  },
  hydrate: () => {
    // SSR-safe: `localStorage` only exists in the browser, and the effect that
    // calls this never runs on the server.
    if (typeof window === 'undefined') return
    let stored: string | null = null
    try {
      stored = window.localStorage.getItem(THEME_STORAGE_KEY)
    } catch {
      stored = null
    }
    const theme = isTheme(stored) ? stored : 'system'
    set({ theme })
    applyTheme(theme)
  },
}))

export function applyTheme(theme: Theme) {
  if (typeof window === 'undefined') return
  const root = document.documentElement
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  const isDark = theme === 'dark' || (theme === 'system' && prefersDark)
  root.classList.toggle('dark', isDark)
}
