import type { MetadataRoute } from 'next'

/**
 * Web app manifest — this is what makes Twivter installable on Android
 * ("Add to Home screen") and on iOS (Share → Add to Home Screen).
 *
 * Served by Next.js at `/manifest.webmanifest`.
 *
 * Icon notes:
 * - `192` and `512` are the sizes Chrome's install prompt looks for.
 * - The `maskable` entry is separate on purpose. Android may crop a normal icon
 *   to any shape it likes, including a circle that would clip the mark's
 *   corners, so the maskable variant keeps the mark inside the centre 80%.
 * - `apple-touch-icon` is referenced from `layout.tsx` instead: iOS ignores
 *   manifest icons and only reads `<link rel="apple-touch-icon">`.
 */
export const dynamic = 'force-static'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Twivter — Connect. Share. Discover.',
    short_name: 'Twivter',
    description:
      'Platform social media modern tempat kamu terhubung, berbagi ide, dan menemukan komunitas.',
    // Relative to the manifest URL, so the Worker can be mounted on any host.
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#ffffff',
    theme_color: '#3b82f6',
    categories: ['social', 'news'],
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    // No `shortcuts` on purpose. The app is a single route whose view lives in a
    // Zustand store, not the URL, so a `?view=messages` shortcut would silently
    // open the home feed instead. Add them together with real URL routing.
  }
}
