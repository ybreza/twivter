import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Generate a unique slug from a name
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50)
}

// Get user initials for avatar fallback
export function getInitials(name: string): string {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

// Truncate text
export function truncate(text: string, max: number): string {
  if (text.length <= max) return text
  return text.slice(0, max) + '…'
}

// Generate a unique filename for uploads
export function generateFileName(originalName: string, prefix = ''): string {
  const ext = originalName.split('.').pop()?.toLowerCase() || 'jpg'
  const timestamp = Date.now()
  const random = Math.random().toString(36).slice(2, 8)
  return `${prefix}${timestamp}-${random}.${ext}`
}

/**
 * Normalises a user-entered website into an absolute `https://` URL.
 *
 * Profiles used to store the domain exactly as typed, so `twivter.com` was
 * persisted without a scheme. That broke three things at once:
 *
 * - `PATCH /api/profiles/me` rejected it, which left the "Simpan" button in the
 *   edit-profile dialog permanently disabled and silently discarded uploaded
 *   avatars, because a disabled save can never persist them.
 * - The profile page rendered it through a next/link `<Link>`, and a
 *   scheme-less value is a *relative* URL, so the router tried to prefetch
 *   `/twivter.com?_rsc=…` and logged a 404 for every visit.
 *
 * Returns `null` for blank or non-website input, so callers can treat "no
 * website" and "invalid website" identically. `www.` is a valid host prefix, so
 * it is preserved; only a missing scheme is added.
 */
export function normalizeWebsiteUrl(raw: string | null | undefined): string | null {
  const value = (raw ?? '').trim()
  if (!value) return null
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(value) ? value : `https://${value}`
  let url: URL
  try {
    url = new URL(withScheme)
  } catch {
    return null
  }
  // Only web URLs are linkable. This also rejects `javascript:` and `data:`,
  // which would otherwise be persisted and later rendered into an href.
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
  if (!url.hostname || !url.hostname.includes('.')) return null
  return url.toString()
}

/** Strips the scheme and trailing slash for display, e.g. `https://a.dev/` → `a.dev`. */
export function displayWebsite(raw: string | null | undefined): string {
  return (raw ?? '').replace(/^https?:\/\//i, '').replace(/\/+$/, '')
}

// Parse JSON safely
export function safeJsonParse<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback
  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}
