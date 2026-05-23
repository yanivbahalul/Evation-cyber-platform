import { NextResponse, type NextRequest } from 'next/server'
import { canAccessAttackMonitorEdge, PORTAL_HOME, resolvePortalUsernameEdge } from '@/lib/auth/portalAccessEdge'

/**
 * Block non-admin operators from the Blue Team dashboard URL before the page shell loads.
 * Edge-safe: JWT cookies only. DB role is enforced again in /api/portal/session.
 */
function edgeSecretsConfigured() {
  return !!(process.env.JWT_SECRET || process.env.GATEWAY_JWT_SECRET)
}

export async function middleware(req: NextRequest) {
  if (!edgeSecretsConfigured()) {
    return NextResponse.next()
  }

  const username = await resolvePortalUsernameEdge(req)
  if (!username) {
    return NextResponse.redirect(new URL('/gateway/login/', req.url))
  }

  const allowed = await canAccessAttackMonitorEdge(req)
  if (!allowed) {
    return NextResponse.redirect(new URL(PORTAL_HOME, req.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/gateway/dashboard', '/gateway/dashboard/'],
}
