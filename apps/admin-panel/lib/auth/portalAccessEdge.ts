import type { NextRequest } from 'next/server'
import { verifyAdminAuthEdge, verifyGatewayAuthEdge } from '@/lib/auth/jwtEdge'

export const PORTAL_HOME = '/gateway/workspace/'

/**
 * Edge middleware gate for /gateway/dashboard — cookie/JWT only (no MongoDB).
 * Authoritative DB role check stays in /api/portal/session (Node runtime).
 */
export async function canAccessAttackMonitorEdge(req: NextRequest): Promise<boolean> {
  const gatewayToken = req.cookies.get('auth')?.value
  if (gatewayToken) {
    const payload = await verifyGatewayAuthEdge(gatewayToken)
    return payload?.role === 'admin'
  }

  const adminToken = req.cookies.get('admin_auth')?.value
  if (adminToken) {
    const payload = await verifyAdminAuthEdge(adminToken)
    return !!payload?.sub
  }

  return false
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
