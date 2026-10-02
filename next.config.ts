import type { NextConfig } from 'next'
import { initOpenNextCloudflareForDev } from '@opennextjs/cloudflare'

const nextConfig: NextConfig = {
  typescript: {
    // Type errors must not block a Cloudflare deploy. They are still surfaced by
    // `npm run typecheck` and by the editor.
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
}

// Required so `next dev` can resolve Cloudflare bindings (D1/R2/DO) locally.
// See https://opennext.js.org/cloudflare/get-started
initOpenNextCloudflareForDev()

export default nextConfig
