import { created, parseJson, withErrorHandler } from '@/lib/api'
import { requireUser } from '@/lib/auth'
import { requestVerification } from '@/lib/data/moderation'
import { reqString } from '@/lib/validate'

// POST /api/verifications — request a verified badge.
// Body: { reason: string } (20–500 characters, reviewed by an admin)
// Returns 201 { success: true }
//
// Nothing ever wrote to the `Verification` table, so the admin verification
// queue was permanently empty and the admin "Verifications" tab was dead. This
// is the missing write path.
//
// Re-submitting while a request is still pending is a 409; a previously
// approved or rejected request is reopened as `pending`.
export const POST = withErrorHandler(async (req) => {
  const user = await requireUser()
  const body = await parseJson(req)

  // Coerced through the validator rather than `.trim()`ed raw, so a numeric or
  // object `reason` is a 400 instead of a 500.
  const reason = reqString(body.reason, 'reason')

  // Enforces the 20..500 character range itself and throws 409 on a duplicate
  // pending request.
  await requestVerification(user.id, reason)

  return created({ success: true })
})