/**
 * The view store is the single source of truth for what is on screen; this
 * module is the translation layer between it and the address bar.
 *
 * Why it exists: the app is one route (`/`), so without this the Android back
 * button has nothing to pop. Pressing it either quit the app or returned to
 * whatever site was open before, which is the behaviour users complained about.
 * Reflecting each view in the URL gives the browser a real history stack, so
 * back walks the screens the user actually visited, and a reload or a shared
 * link lands on the right screen.
 *
 * Home is the canonical URL with no query string, which matters: it means the
 * app's root is a true history root, so pressing back *on home* leaves the app
 * instead of trapping the user in an endless back loop.
 *
 * Only `view` and the two parameters that identify a screen (`u`, `p`) are
 * encoded. `conversationId` and `searchQuery` deliberately stay in memory:
 * `setSearchQuery` fires on every keystroke, and encoding it would push a
 * history entry per character.
 */
import type { ViewName } from '@/stores/app-store'

export interface ViewLocation {
  view: ViewName
  profileUsername: string | null
  postId: string | null
}

const VIEW_NAMES: ViewName[] = [
  'landing', 'login', 'register', 'onboarding', 'home', 'explore', 'notifications',
  'messages', 'bookmarks', 'communities', 'settings', 'admin', 'profile', 'post-detail',
]

const isViewName = (value: string | null): value is ViewName =>
  value !== null && (VIEW_NAMES as string[]).includes(value)

/** The view the app shows when the URL carries nothing to go on. */
export const DEFAULT_LOCATION: ViewLocation = { view: 'home', profileUsername: null, postId: null }

/** Picks the current location out of the view store's state. */
export function locationOf(state: {
  view: ViewName
  profileUsername: string | null
  postId: string | null
}): ViewLocation {
  return {
    view: state.view,
    // A profile or post screen without its identifier is meaningless, so it is
    // treated as "not that screen" rather than encoding a broken link.
    profileUsername: state.view === 'profile' ? state.profileUsername : null,
    postId: state.view === 'post-detail' ? state.postId : null,
  }
}

export function sameLocation(a: ViewLocation, b: ViewLocation): boolean {
  return a.view === b.view && a.profileUsername === b.profileUsername && a.postId === b.postId
}

/** Encodes a location as a query string without the leading `?`. Home → ''. */
export function encodeView(location: ViewLocation): string {
  const params = new URLSearchParams()
  if (location.view === 'home') return ''
  params.set('view', location.view)
  if (location.view === 'profile' && location.profileUsername) {
    params.set('u', location.profileUsername)
  }
  if (location.view === 'post-detail' && location.postId) {
    params.set('p', location.postId)
  }
  return params.toString()
}

/**
 * Decodes a query string back into a location. Returns null when the URL names
 * no screen, which means "home".
 *
 * The legacy `?post=<id>` form is still accepted: PostCard's share button
 * produced it before URLs carried a view, and those links are already in the
 * wild.
 */
export function decodeView(search: string): ViewLocation | null {
  const params = new URLSearchParams(search)

  const legacyPost = params.get('post')
  if (legacyPost) return { view: 'post-detail', profileUsername: null, postId: legacyPost }

  const view = params.get('view')
  if (!isViewName(view)) return null

  const username = params.get('u')
  const postId = params.get('p')

  if (view === 'profile' && !username) return null
  if (view === 'post-detail' && !postId) return null

  return {
    view,
    profileUsername: view === 'profile' ? username : null,
    postId: view === 'post-detail' ? postId : null,
  }
}

/** The full href for a location, preserving the current path and hash. */
export function hrefFor(location: ViewLocation): string {
  const search = encodeView(location)
  const { pathname, hash } = window.location
  return `${pathname}${search ? `?${search}` : ''}${hash}`
}

// ── App history depth ────────────────────────────────────────────────────────
//
// Tracks how many entries this app pushed on top of the page the user arrived
// on, so the in-app back button can call `history.back()` (which walks the real
// stack) instead of jumping to home. Without this, in-app back and the Android
// back button disagree about where "back" is.

let depth = 0
let expectPop = false

/** Called after this app pushes an entry. */
export function notePush(): void {
  depth++
}

/**
 * Goes back one app entry. Returns false when there is nothing of ours to pop,
 * so callers can fall back to navigating home instead.
 */
export function goBackInApp(): boolean {
  if (depth <= 0) return false
  depth--
  // The popstate we are about to cause is ours; do not count it twice.
  expectPop = true
  window.history.back()
  return true
}

/** Called on every popstate; see `goBackInApp` for why `expectPop` exists. */
export function notePop(): void {
  if (expectPop) {
    expectPop = false
    return
  }
  if (depth > 0) depth--
}
