import { NextResponse, type NextRequest } from 'next/server'
import { canAccessAttackMonitorEdge, PORTAL_HOME, resolvePortalUsernameEdge } from '@/lib/auth/portalAccessEdge'
import { applyGatewayClientIpHeaders } from '@/lib/forwardGatewayClientIp'

/**
 * Block non-admin operators from the Blue Team dashboard URL before the page shell loads.
 * Edge-safe: JWT cookies only. DB role is enforced again in /api/portal/session.
 */
function edgeSecretsConfigured() {
  return !!(process.env.JWT_SECRET || process.env.GATEWAY_JWT_SECRET)
}

function nextWithGatewayClientIp(req: NextRequest) {
  const headers = applyGatewayClientIpHeaders(req, new Headers(req.headers))
  return NextResponse.next({ request: { headers } })
}

async function requireAttackMonitorAccess(req: NextRequest) {
  const username = await resolvePortalUsernameEdge(req)
  if (!username) {
    return NextResponse.redirect(new URL('/gateway/login/', req.url))
  }
  const allowed = await canAccessAttackMonitorEdge(req)
  if (!allowed) {
    return NextResponse.redirect(new URL(PORTAL_HOME, req.url))
  }
  return null
}

export async function middleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname

  const isAdminAlias = pathname === '/admin/map' || pathname === '/admin/ban'
  if (isAdminAlias && edgeSecretsConfigured()) {
    const denied = await requireAttackMonitorAccess(req)
    if (denied) return denied
    return NextResponse.next()
  }

  if (!pathname.startsWith('/gateway')) {
    return NextResponse.next()
  }

  const isDashboard =
    pathname === '/gateway/dashboard' || pathname === '/gateway/dashboard/'

  if (isDashboard && edgeSecretsConfigured()) {
    const denied = await requireAttackMonitorAccess(req)
    if (denied) return denied
  }

  // Inject X-Forwarded-For / X-Client-IP before next.config rewrites proxy to Express.
  return nextWithGatewayClientIp(req)
}

export const config = {
  matcher: ['/gateway', '/gateway/:path*', '/admin/map', '/admin/ban'],
  // Node runtime so we can read the TCP peer (LAN clients) before /gateway rewrites to Express.
  runtime: 'nodejs',
}
