import { NextResponse, type NextRequest } from 'next/server'
import { jwtVerify } from 'jose'
import { verifyJwt, signJwt } from '@/lib/auth/jwt'

export const runtime = 'nodejs'

/** Must match `services/innotech-gateway` (`GATEWAY_JWT_SECRET` || `JWT_SECRET`). */
function getGatewayJwtKey() {
  const secret = process.env.GATEWAY_JWT_SECRET || process.env.JWT_SECRET
  if (!secret) return null
  return new TextEncoder().encode(secret)
}

/**
 * Session for the Blue Team UI:
 * 1. Prefer `admin_auth` (panel login / exchange).
 * 2. If missing, accept the gateway `auth` cookie: same-origin users who clicked
 *    “Open Admin Panel” from Safe Zone already have a session — mint `admin_auth`
 *    when the gateway JWT says `role === 'admin'`.
 */
export async function GET(req: NextRequest) {
  const adminToken = req.cookies.get('admin_auth')?.value
  if (adminToken) {
    try {
      const payload = await verifyJwt<{ sub: string }>(adminToken, 'auth')
      return NextResponse.json({ authenticated: true, sub: payload.sub }, { status: 200 })
    } catch {
      // Invalid/expired panel token — try gateway cookie below
    }
  }

  const gatewayKey = getGatewayJwtKey()
  const gatewayCookie = req.cookies.get('auth')?.value
  if (gatewayKey && gatewayCookie) {
    try {
      const { payload } = await jwtVerify(gatewayCookie, gatewayKey, {
        issuer: 'innotech-gateway',
      })
      const username = typeof payload.username === 'string' ? payload.username : ''
      const role = typeof payload.role === 'string' ? payload.role : ''
      if (role !== 'admin' || !username) {
        return NextResponse.json({ authenticated: false }, { status: 200 })
      }

      const auth = await signJwt({ sub: username }, 'auth', '8h')
      const res = NextResponse.json({ authenticated: true, sub: username }, { status: 200 })
      res.cookies.set({
        name: 'admin_auth',
        value: auth,
        httpOnly: true,
        sameSite: 'strict',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        maxAge: 60 * 60 * 8,
      })
      return res
    } catch {
      return NextResponse.json({ authenticated: false }, { status: 200 })
    }
  }

  return NextResponse.json({ authenticated: false }, { status: 200 })
}
