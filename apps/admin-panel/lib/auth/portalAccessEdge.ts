import type { NextRequest } from 'next/server'
import { verifyAdminAuthEdge, verifyGatewayAuthEdge } from '@/lib/auth/jwtEdge'

export const PORTAL_HOME = '/gateway/workspace/'

/**
 * JWT-only hint (no DB). Prefer middleware /api/portal/session with dbRoleForUsername.
 * Does not grant access on admin_auth alone — role must be in gateway `auth` JWT.
 */
export async function canAccessAttackMonitorEdge(req: NextRequest): Promise<boolean> {
  const gatewayToken = req.cookies.get('auth')?.value
  if (!gatewayToken) return false
  const payload = await verifyGatewayAuthEdge(gatewayToken)
  return payload?.role === 'admin'
}

export async function resolvePortalUsernameEdge(req: NextRequest): Promise<string | null> {
  const gatewayToken = req.cookies.get('auth')?.value
  if (gatewayToken) {
    const payload = await verifyGatewayAuthEdge(gatewayToken)
    return payload?.username || payload?.sub || null
  }

  const adminToken = req.cookies.get('admin_auth')?.value
  if (adminToken) {
    const payload = await verifyAdminAuthEdge(adminToken)
    if (payload?.sub) return payload.sub
  }

  return null
}
