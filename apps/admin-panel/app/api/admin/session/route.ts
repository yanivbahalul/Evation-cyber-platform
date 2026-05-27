import { NextResponse, type NextRequest } from 'next/server'
import { verifyJwt } from '@/lib/auth/jwt'
import { verifyGatewayAuthToken } from '@/lib/auth/gatewayJwt'
import {
  dbRoleForUsername,
  portalAttackMonitorPath,
  portalHomePath,
} from '@/lib/auth/portalAccess'

export const runtime = 'nodejs'

/**
 * Session probe for the unified login shell.
 * `redirectTo` follows DB role — employees never get the attack-monitor URL.
 */
export async function GET(req: NextRequest) {
  const adminToken = req.cookies.get('admin_auth')?.value
  if (adminToken) {
    try {
      const payload = await verifyJwt<{ sub: string }>(adminToken, 'auth')
      const username = payload.sub
      if (!username) {
        return NextResponse.json({ authenticated: false }, { status: 200 })
      }
      const role = await dbRoleForUsername(username)
      if (role !== 'admin') {
        return NextResponse.json({ authenticated: false }, { status: 200 })
      }
      return NextResponse.json(
        {
          authenticated: true,
          kind: 'admin',
          sub: username,
          role: 'admin',
          redirectTo: portalHomePath(),
          attackMonitorUrl: portalAttackMonitorPath(),
        },
        { status: 200 }
      )
    } catch {
      // fall through
    }
  }

  const gatewayToken = req.cookies.get('auth')?.value
  if (gatewayToken) {
    try {
      const payload = await verifyGatewayAuthToken<{ username?: string; sub?: string }>(gatewayToken)
      const username = payload.username || String(payload.sub || '') || ''
      if (!username) {
        return NextResponse.json({ authenticated: false }, { status: 200 })
      }
      const role = await dbRoleForUsername(username)
      return NextResponse.json(
        {
          authenticated: true,
          kind: 'safezone',
          sub: username,
          role,
          redirectTo: portalHomePath(),
          attackMonitorUrl: role === 'admin' ? portalAttackMonitorPath() : null,
        },
        { status: 200 }
      )
    } catch {
      // fall through
    }
  }

  return NextResponse.json({ authenticated: false }, { status: 200 })
}
