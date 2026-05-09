import { NextResponse, type NextRequest } from 'next/server'
import { SignJWT, jwtVerify } from 'jose'

export const runtime = 'nodejs'

function getKey() {
  const secret = process.env.JWT_SECRET
  if (!secret) throw new Error('Missing JWT_SECRET')
  return new TextEncoder().encode(secret)
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token') || ''
  if (!token) return NextResponse.json({ success: false, error: 'Missing token' }, { status: 400 })

  let payload: { sub?: string; purpose?: string }
  try {
    const { payload: p } = await jwtVerify(token, getKey(), { issuer: 'innotech-gateway-exchange' })
    payload = p as any
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid/expired token' }, { status: 401 })
  }

  if (payload.purpose !== 'exchange' || !payload.sub) {
    return NextResponse.json({ success: false, error: 'Invalid token payload' }, { status: 401 })
  }

  // Issue the standard Blue Team auth cookie (purpose=auth).
  const now = Math.floor(Date.now() / 1000)
  const auth = await new SignJWT({ sub: payload.sub, purpose: 'auth' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt(now)
    .setIssuer('innotech-honeynet')
    .setExpirationTime('8h')
    .sign(getKey())

  const res = NextResponse.redirect(new URL('/', req.url))
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
}

