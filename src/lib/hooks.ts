'use client'

import { useEffect, useState, useCallback } from 'react'

// Lightweight fetch hook for GET endpoints (no React Query to keep deps minimal in views)
export function useApi<T>(url: string | null, options?: { deps?: any[]; skip?: boolean }) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(!options?.skip)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    if (!url) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(url, { cache: 'no-store' })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || `HTTP ${res.status}`)
      }
      const json = await res.json()
      setData(json)
    } catch (e: any) {
      setError(e.message || 'Gagal memuat data')
    } finally {
      setLoading(false)
    }
  }, [url])

  useEffect(() => {
    if (options?.skip) return
    refetch()
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
