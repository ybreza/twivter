/**
 * Minimal structural types for the Cloudflare bindings this app uses.
 *
 * The full `@cloudflare/workers-types` declarations are loaded only by
 * `tsconfig.worker.json` (for `worker.ts` and `src/cloudflare/**`). They cannot
 * be used in the app's TypeScript project, because the Workers `Response`
 * declares `json(): Promise<unknown>` and that would turn every `res.json()`
 * call site in the app into an error.
 *
 * Route handlers still run on workerd, so these describe exactly the surface
 * they touch and nothing more.
 */

/** A handle to one Durable Object instance. */
export interface DurableObjectStubLike {
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>
}

/** The namespace a Durable Object class is bound to. */
export interface DurableObjectNamespaceLike {
  idFromName(name: string): unknown
  get(id: unknown): DurableObjectStubLike
}

/** A single object stored in R2. */
export interface R2ObjectBodyLike {
  body: ReadableStream | null
  httpMetadata?: { contentType?: string; cacheControl?: string }
  size: number
  etag: string
  uploaded: Date | string
}

/** The subset of the R2 bucket API this app relies on. */
export interface R2BucketLike {
  put(
    key: string,
    value: ArrayBuffer | Uint8Array | ReadableStream,
    options?: unknown,
  ): Promise<unknown>
  get(key: string): Promise<R2ObjectBodyLike | null>
  delete(keys: string | string[]): Promise<void>
}