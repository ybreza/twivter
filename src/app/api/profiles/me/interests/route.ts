import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { requireUser } from '@/lib/auth'
import { ok, badRequest, withErrorHandler, parseJson } from '@/lib/api'
import { serializeProfile } from '@/lib/serialize'
import { INTEREST_OPTIONS } from '@/lib/types'

// PATCH /api/profiles/me/interests
// Body: { interests: string[] }
// Stores the array as JSON.stringify on the User.interests column (matches
// the convention set by the onboarding route).
export const PATCH = withErrorHandler(async (req: NextRequest) => {
  const user = await requireUser()
  const body = await parseJson<{ interests?: string[] }>(req)

  const raw = Array.isArray(body.interests) ? body.interests : []
  // de-dup + filter against the known options set
  const valid = new Set<string>(INTEREST_OPTIONS)
  const cleaned = Array.from(new Set(raw.map((s) => String(s).trim()).filter(Boolean))).filter((s) =>
    valid.has(s as any)
  )
  if (cleaned.length > 10) {
    return badRequest('Maksimal 10 minat')
  }

  const updated = await db.user.update({
    where: { id: user.id },
    data: { interests: JSON.stringify(cleaned) },
  })

  const profile = await serializeProfile(updated, updated.id)
  return ok(profile)
})
