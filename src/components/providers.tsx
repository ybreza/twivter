'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useAuthStore, useThemeStore, applyTheme } from '@/stores/app-store'

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30 * 1000,
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      })
  )

  const theme = useThemeStore((s) => s.theme)
  const hydrateTheme = useThemeStore((s) => s.hydrate)
  const setUser = useAuthStore((s) => s.setUser)
  const setLoading = useAuthStore((s) => s.setLoading)

  // Restore the persisted theme choice before applying it. Without this the
  // store always started at 'system' and the user's dark-mode pick was lost on
  // every reload.
  useEffect(() => {
    hydrateTheme()
  }, [hydrateTheme])

  // Apply theme on mount + listen to system changes
  useEffect(() => {
    applyTheme(theme)
    if (theme === 'system') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)')
      const handler = () => applyTheme('system')
      mq.addEventListener('change', handler)
      return () => mq.removeEventListener('change', handler)
    }
  }, [theme])

  // Bootstrap current session
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/auth/me', { cache: 'no-store' })
        if (cancelled) return
        if (res.ok) {
          const data = await res.json()
          setUser(data.user)
        } else {
          setUser(null)
        }
      } catch {
        if (!cancelled) setUser(null)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [setUser])

  // Register the service worker. Chrome will not offer "Install app" without
  // one, and iOS uses it for the offline shell. Registration is skipped in
  // development: a cached shell would keep serving a stale build and mask edits.
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return
    const register = () => {
      navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {
        /* offline support is a progressive enhancement; never block the app */
      })
    }
    if (document.readyState === 'complete') register()
    else window.addEventListener('load', register, { once: true })
  }, [])

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}
