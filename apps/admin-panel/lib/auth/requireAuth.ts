import type { NextRequest } from 'next/server'
import { verifyJwt } from './jwt'
import { verifyGatewayAuthToken } from './gatewayJwt'

/**
 * Accept Blue Team session (`admin_auth`) or gateway HR login (`auth`).
 * Gateway admins reach /gateway/dashboard with only the `auth` cookie.
 */
export async function requireAuth(req: NextRequest) {
  const adminToken = req.cookies.get('admin_auth')?.value
  if (adminToken) {
    try {
      const payload = await verifyJwt<{ sub: string }>(adminToken, 'auth')
      if (payload.sub) return payload
    } catch {
      // fall through to gateway cookie
    }
  }

  const gatewayToken = req.cookies.get('auth')?.value
  if (gatewayToken) {
    try {
      const payload = await verifyGatewayAuthToken<{ username?: string; sub?: string }>(gatewayToken)
      const sub = (payload.username || String(payload.sub || '')).trim()
      if (!sub) throw new Error('missing_auth')
      return { sub }
    } catch {
      // fall through
    }
  }

  throw new Error('missing_auth')
}
