/**
 * Service worker for Twivter.
 *
 * Chrome only shows the "Install app" prompt once a page is served over HTTPS
 * *and* controlled by a service worker with a fetch handler, so this file is
 * what actually makes the app installable on Android. iOS ignores it for
 * installation (the manifest and `apple-touch-icon` are what matter there) but
 * still uses it for the offline fallback.
 *
 * Strategy: network-first for navigations and API reads, cache-first for static
 * assets. Nothing is ever served stale for `/api/*` — a stale timeline or a stale
 * session check is worse than an error, and auth is cookie-scoped anyway.
 */
const VERSION = 'twivter-v1'
const SHELL = `${VERSION}-shell`
const ASSETS = `${VERSION}-assets`

/** App shell, precached so a cold offline launch still renders something. */
const PRECACHE = ['/', '/manifest.webmanifest', '/logo.svg', '/icons/icon-192.png']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL)
      // `addAll` rejects wholesale if any single entry 404s, so add them
      // individually and let the ones that fail be retried on the next visit.
      .then((cache) => Promise.allSettled(PRECACHE.map((url) => cache.add(url))))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== SHELL && k !== ASSETS).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  // Only handle our own origin; R2 media and third-party embeds go direct.
  if (url.origin !== self.location.origin) return
  // Never cache the API: stale posts, notifications or session state are worse
  // than a visible failure, and `/api/auth/me` drives the whole app's auth state.
  if (url.pathname.startsWith('/api/')) return
  if (url.pathname.startsWith('/uploads/')) return

  // Navigations: try the network so a deploy is picked up immediately, fall back
  // to the cached shell when offline.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone()
          caches.open(SHELL).then((cache) => cache.put('/', copy))
          return response
        })
        .catch(() => caches.match('/').then((hit) => hit || Response.error())),
    )
    return
  }

  // Static assets are content-stable, so serve from cache and refresh in the
  // background.
  event.respondWith(
    caches.match(request).then((hit) => {
      if (hit) return hit
      return fetch(request).then((response) => {
        if (response.ok && response.type === 'basic') {
          const copy = response.clone()
          caches.open(ASSETS).then((cache) => cache.put(request, copy))
        }
        return response
      })
    }),
  )
})
