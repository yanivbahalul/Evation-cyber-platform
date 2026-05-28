import type { NextRequest } from 'next/server'
import { verifyJwt } from '@/lib/auth/jwt'
import { verifyGatewayAuthToken } from '@/lib/auth/gatewayJwt'
import { getAdminModels } from '@/lib/server/adminDb'
import { getSafezoneModels } from '@/lib/server/safezoneDb'

export type PortalRole = 'admin' | 'user'

/** Authoritative role from DB — never trust JWT `role` alone. */
export async function dbRoleForUsername(username: string): Promise<PortalRole> {
  const { AdminUser } = await getAdminModels()
  const au = await AdminUser.findOne({ username, isActive: true }).select('role').lean()
  if (au) {
    return (au as { role?: string }).role === 'admin' ? 'admin' : 'user'
  }

  const { User } = await getSafezoneModels()
  const u = await User.findOne({ username, isActive: true }).select('role').lean()
  if (u && (u as { role?: string }).role === 'admin') return 'admin'

  return 'user'
}

/** Post-login landing for every operator (HR workspace). */
export function portalHomePath(): string {
  return '/gateway/workspace/'
}

/** Blue Team attack monitor — linked in UI only when DB role is admin. */
export function portalAttackMonitorPath(): string {
  return '/gateway/dashboard/'
}

export async function resolvePortalUsername(req: NextRequest): Promise<string | null> {
  const adminToken = req.cookies.get('admin_auth')?.value
  if (adminToken) {
    try {
      const payload = await verifyJwt<{ sub: string }>(adminToken, 'auth')
      return payload.sub || null
    } catch {
      // fall through
    }
  }

  const gatewayToken = req.cookies.get('auth')?.value
  if (gatewayToken) {
    try {
      const payload = await verifyGatewayAuthToken<{ username?: string; sub?: string }>(gatewayToken)
      return payload.username || String(payload.sub || '') || null
    } catch {
      // fall through
    }
  }

  return null
}
