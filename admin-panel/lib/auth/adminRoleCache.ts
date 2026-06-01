import type { NextRequest } from 'next/server'
import { requireAuth } from '@/lib/auth/requireAuth'
import { getAdminModels } from '@/lib/server/adminDb'
import { getSafezoneModels } from '@/lib/server/safezoneDb'

const TTL_MS = 60_000
const hits = new Map<string, { ok: boolean; at: number }>()

async function isAdminUsername(username: string): Promise<boolean> {
  const { AdminUser } = await getAdminModels()
  const me = await AdminUser.findOne({ username, isActive: true }).lean()
  if (me && (me as { role?: string }).role === 'admin') return true

  const { User } = await getSafezoneModels()
  const u = await User.findOne({ username, isActive: true }).lean()
  return Boolean(u && (u as { role?: string }).role === 'admin')
}

/**
 * Cached admin gate for high-frequency dashboard polling (same session, many GETs).
 */
export async function requireAdmin(req: NextRequest) {
  const auth = await requireAuth(req)
  const username = auth.sub
  if (!username) throw new Error('forbidden')

  const now = Date.now()
  const cached = hits.get(username)
  if (cached && now - cached.at < TTL_MS) {
    if (!cached.ok) throw new Error('forbidden')
    return auth
  }

  const ok = await isAdminUsername(username)
  hits.set(username, { ok, at: now })
  if (!ok) throw new Error('forbidden')
  return auth
}
