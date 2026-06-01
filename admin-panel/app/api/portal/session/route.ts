import { NextResponse, type NextRequest } from 'next/server'
import {
  dbRoleForUsername,
  portalAttackMonitorPath,
  portalHomePath,
  resolvePortalUsername,
} from '@/lib/auth/portalAccess'

export const runtime = 'nodejs'

/**
 * Unified portal session — `role` from DB decides home URL (not JWT `role`).
 */
export async function GET(req: NextRequest) {
  const username = await resolvePortalUsername(req)
  if (!username) {
    return NextResponse.json({ authenticated: false }, { status: 200 })
  }

  const role = await dbRoleForUsername(username)
  return NextResponse.json(
    {
      authenticated: true,
      sub: username,
      role,
      redirectTo: portalHomePath(),
      attackMonitorUrl: role === 'admin' ? portalAttackMonitorPath() : null,
    },
    { status: 200 }
  )
}
