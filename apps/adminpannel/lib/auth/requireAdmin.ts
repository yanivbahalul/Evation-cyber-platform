import type { NextRequest } from 'next/server'
import { requireAuth } from '@/lib/auth/requireAuth'
import { getAdminModels } from '@/lib/server/adminDb'
import { getSafezoneModels } from '@/lib/server/safezoneDb'

/**
 * Operator must be allowed to manage the Blue Team panel:
 * - `admin_users` document with role `admin`, or
 * - Same username in Safe Zone `users` with role `admin` (gateway-only admins).
 *
 * This avoids Forbidden when the operator exists only in `users` or URIs differ between services.
 */
export async function requireAdmin(req: NextRequest) {
  const auth = await requireAuth(req)
  const username = auth.sub
  if (!username) throw new Error('forbidden')

  const { AdminUser } = await getAdminModels()
  const me = await AdminUser.findOne({ username, isActive: true }).lean()
  if (me && (me as { role?: string }).role === 'admin') return auth

  const { User } = await getSafezoneModels()
  const u = await User.findOne({ username, isActive: true }).lean()
  if (u && (u as { role?: string }).role === 'admin') return auth

  throw new Error('forbidden')
}
