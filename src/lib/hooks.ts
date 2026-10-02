'use client'

import { useEffect, useRef, useState, useCallback } from 'react'

// Lightweight fetch hook for GET endpoints (no React Query to keep deps minimal in views)
export function useApi<T>(url: string | null, options?: { deps?: any[]; skip?: boolean }) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(!options?.skip)
  const [error, setError] = useState<string | null>(null)

  // Read inside `refetch` without making it a dependency, so a stable `refetch`
  // identity is kept for consumers that put it in effect dependency arrays.
  const urlRef = useRef(url)
  urlRef.current = url

  const abortRef = useRef<AbortController | null>(null)
  // Set on unmount so no state update ever happens after the view is gone.
  const ignoreRef = useRef(false)

  const refetch = useCallback(async () => {
    const target = urlRef.current
    if (!target) return
    setLoading(true)
    setError(null)
    // Cancels the previous request so a slow response for an old URL cannot
    // land after the URL changed.
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    try {
      const res = await fetch(target, { cache: 'no-store', signal: controller.signal })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || `HTTP ${res.status}`)
      }
      const json = await res.json()
      if (ignoreRef.current || controller.signal.aborted) return
      setData(json)
    } catch (e: any) {
      if (e?.name === 'AbortError') return
      if (ignoreRef.current) return
      setError(e.message || 'Gagal memuat data')
    } finally {
      if (!ignoreRef.current && !controller.signal.aborted) setLoading(false)
    }
  }, [])

  useEffect(() => {
    ignoreRef.current = false
    // A new URL means the previous response describes a different resource.
    setData(null)
    if (options?.skip || !url) return
    refetch().catch(() => {
      /* handled inside refetch */
    })
    return () => {
      ignoreRef.current = true
      abortRef.current?.abort()
    }
  }, [url, ...(options?.deps ?? [])])

  return { data, loading, error, refetch, setData }
}

// API client helper
export async function apiPost<T = any>(url: string, body?: any): Promise<T> {
  // FormData: let the browser set the correct Content-Type (multipart/form-data)
  // with the proper boundary. Do NOT override it with application/json.
  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData
  const res = await fetch(url, {
    method: 'POST',
    headers: isFormData ? undefined : { 'Content-Type': 'application/json' },
    body: isFormData ? body : body ? JSON.stringify(body) : undefined,
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((json as any).error || `HTTP ${res.status}`)
  return json as T
}

export async function apiDelete<T = any>(url: string): Promise<T> {
  const res = await fetch(url, { method: 'DELETE' })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((json as any).error || `HTTP ${res.status}`)
  return json as T
}

export async function apiPatch<T = any>(url: string, body?: any): Promise<T> {
  const res = await fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((json as any).error || `HTTP ${res.status}`)
  return json as T
}
