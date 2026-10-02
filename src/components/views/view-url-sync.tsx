'use client'

/**
 * Keeps the address bar and the view store in sync, in both directions.
 *
 * store → URL: every view change pushes a history entry, so the Android back
 * button walks the screens the user visited instead of leaving the app.
 *
 * URL → store: `popstate` (back/forward), the first render after a reload, and
 * any shared link restore the matching view. Without this half, going back would
 * change the URL but leave the old screen rendered.
 *
 * The two directions can otherwise loop — pushing a URL makes the store change,
 * which would push a URL — so a flag marks the window in which the store is
 * being written *because* of the URL, and the store → URL direction stands
 * down for that update.
 */
import { useEffect, useRef } from 'react'
import { useViewStore } from '@/stores/app-store'
import { decodeView, DEFAULT_LOCATION, hrefFor, locationOf, notePop, notePush, sameLocation } from '@/lib/view-url'

export function ViewUrlSync() {
  // True only while the URL is being applied to the store.
  const applyingFromUrl = useRef(false)

  // ── URL → store ────────────────────────────────────────────────────────────
  useEffect(() => {
    const apply = () => {
      notePop()
      // A URL with no parameters means home. That is not a no-op: popping back
      // onto the bare path has to *leave* a sub-view, or the address bar says
      // home while the previous screen stays rendered.
      const location = decodeView(window.location.search) ?? DEFAULT_LOCATION
      const state = useViewStore.getState()
      if (sameLocation(locationOf(state), location)) return

      applyingFromUrl.current = true
      state.navigate(location.view, {
        profileUsername: location.profileUsername,
        postId: location.postId,
      })
      // Zustand notifies subscribers synchronously, so clearing after the call
      // is enough — the flag has already been observed.
      applyingFromUrl.current = false
    }

    // Runs on mount too, which is what makes a reload or a shared link land on
    // the right screen rather than always on home.
    apply()
    window.addEventListener('popstate', apply)
    return () => window.removeEventListener('popstate', apply)
  }, [])

  // ── store → URL ────────────────────────────────────────────────────────────
  useEffect(() => {
    return useViewStore.subscribe((state, previous) => {
      if (applyingFromUrl.current) return

      const next = locationOf(state)
      if (sameLocation(next, locationOf(previous))) return

      // Landing is the browser's own "outside the app" entry point, so it must
      // stay a bare path. Everything else gets a real entry to go back to.
      const toBare = next.view === 'home' || next.view === 'landing'
      const href = hrefFor(next)
      if (href === `${window.location.pathname}${window.location.search}${window.location.hash}`) {
        return
      }

      if (toBare) {
        window.history.replaceState(null, '', href)
      } else {
        window.history.pushState(null, '', href)
        notePush()
      }
    })
  }, [])

  return null
}
