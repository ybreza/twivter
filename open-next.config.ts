import { defineCloudflareConfig } from '@opennextjs/cloudflare'
import r2IncrementalCache from '@opennextjs/cloudflare/overrides/incremental-cache/r2-incremental-cache'

// Deploy target: Cloudflare Workers (via OpenNext).
// Incremental cache lives in the NEXT_INC_CACHE_R2_BUCKET R2 bucket.
export default defineCloudflareConfig({
  incrementalCache: r2IncrementalCache,
})