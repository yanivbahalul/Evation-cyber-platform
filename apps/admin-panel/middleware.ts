import { NextResponse, type NextRequest } from 'next/server'
import { canAccessAttackMonitorEdge, PORTAL_HOME, resolvePortalUsernameEdge } from '@/lib/auth/portalAccessEdge'
import { applyGatewayClientIpHeaders, resolveMiddlewareClientIp } from '@/lib/forwardGatewayClientIp'

/**
 * Per Requirements §"Real Admin Login → Protection": the dashboard URL is
 * only reachable from authorized IPs. Requests from unknown IPs are treated
 * as recon and silently rerouted to the gateway's fake-login honeypot (the
 * spec's "404 / fake login trap" outcome).
 *
 * Set ADMIN_IP_ALLOWLIST as a comma-separated list of exact IPv4/IPv6
 * literals (CIDR not supported in Edge runtime). Loopback is always allowed
 * for local dev. Leave the env var unset to disable the check.
 */
function ipAllowlist(): Set<string> {
  const raw = process.env.ADMIN_IP_ALLOWLIST || ''
  return new Set(raw.split(',').map((s) => s.trim()).filter(Boolean))
}

function isLoopbackIp(ip: string) {
  return ip === '127.0.0.1' || ip === '::1' || ip === 'localhost'
}

function adminIpAllowed(req: NextRequest): boolean {
  const allow = ipAllowlist()
  if (allow.size === 0) return true
  const ip = resolveMiddlewareClientIp(req)
  if (!ip || ip === 'unknown') return false
  if (isLoopbackIp(ip)) return true
  return allow.has(ip)
}

function adminPathScope(pathname: string): boolean {
  if (pathname === '/' || pathname === '/login' || pathname === '/register') return true
  if (pathname.startsWith('/admin/')) return true
  if (pathname.startsWith('/dashboard')) return true
  if (pathname.startsWith('/ops')) return true
  return false
}

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

  // Admin IP allowlist (per Requirements §Real Admin Login). Unknown IPs hitting
  // any admin-panel route are rerouted to the gateway fake-login trap.
  if (adminPathScope(pathname) && !adminIpAllowed(req)) {
    const trapUrl = new URL('/gateway/internal/auth/legacy', req.url)
    return NextResponse.redirect(trapUrl)
  }

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
  matcher: [
    '/',
    '/login',
    '/register',
    '/admin/:path*',
    '/dashboard/:path*',
    '/ops/:path*',
    '/gateway',
    '/gateway/:path*',
  ],
  // Node runtime so we can read the TCP peer (LAN clients) before /gateway rewrites to Express.
  runtime: 'nodejs',
}
