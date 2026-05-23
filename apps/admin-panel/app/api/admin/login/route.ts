import { NextResponse, type NextRequest } from 'next/server'
import { signJwt } from '@/lib/auth/jwt'
import { getAdminModels } from '@/lib/server/adminDb'
import { getSafezoneModels } from '@/lib/server/safezoneDb'
// bcryptjs ships without perfect TS resolution in some Next setups; require avoids TS module resolution issues.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const bcrypt = require('bcryptjs')

export const runtime = 'nodejs'

function jsonError(message: string, status = 400) {
  return NextResponse.json({ success: false, error: message }, { status })
}

export async function POST(req: NextRequest) {
  let body: { username?: string; password?: string }
  try {
    body = await req.json()
  } catch {
    return jsonError('Invalid JSON body')
  }

  const username = body.username?.trim() ?? ''
  const password = body.password ?? ''

  if (!username || !password) return jsonError('Missing username or password', 400)

  // Unified login:
  // - If the user is an admin, proceed to Blue Team 2FA.
  // - If the user is a regular employee (Safe Zone), also proceed to 2FA but redirect to /gateway/*.
  try {
    const { AdminUser } = await getAdminModels()
    const user = await AdminUser.findOne({
      username,
      $or: [{ isActive: true }, { isActive: { $exists: false } }],
    }).select('+password')
    // Not found in admin DB → fall through to Safe Zone auth.
    if (!user) throw new Error('not_in_admin_db')

    // Primary path: hashed password
    if (typeof (user as any).passwordHash === 'string' && (user as any).passwordHash.length > 0) {
      const ok = await bcrypt.compare(password, (user as any).passwordHash)
      if (!ok) return jsonError('Invalid credentials', 401)
    } else {
      // Optional one-time migration for legacy plaintext field: ONLY if explicitly enabled.
      const allowPlaintext = process.env.ALLOW_PLAINTEXT_ADMIN_PASSWORD === 'true'
      if (!allowPlaintext) return jsonError('Invalid credentials', 401)

      const legacyPassword = (user as any).password
      if (typeof legacyPassword !== 'string') return jsonError('Invalid credentials', 401)
      if (password !== legacyPassword) return jsonError('Invalid credentials', 401)

      // Upgrade in place: set passwordHash and remove plaintext password field.
      const passwordHash = await bcrypt.hash(password, 12)
      ;(user as any).passwordHash = passwordHash
      ;(user as any).password = undefined
      await user.save()
    }

    const role = ((user as any).role as string | undefined) || 'user'
    const kind = role === 'admin' ? 'admin' : 'safezone'
    const pre2fa = await signJwt({ sub: username, kind }, 'pre2fa', '5m')
    const res = NextResponse.json({ success: true, next: 'otp' })
    res.cookies.set({
      name: 'pre_2fa',
      value: pre2fa,
      httpOnly: true,
      sameSite: 'strict',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 5,
    })
    return res
  } catch {
    // If admin DB auth fails, fall through to Safe Zone (regular user) auth below.
  }

  // 2) Safe Zone user auth (employees)
  try {
    const { User } = await getSafezoneModels()
    const u = await User.findOne({ username, isActive: true }).select('+totpSecret')
    if (!u) return jsonError('Invalid credentials', 401)
    const ok = await bcrypt.compare(password, (u as any).passwordHash)
    if (!ok) return jsonError('Invalid credentials', 401)

    const pre2fa = await signJwt({ sub: username, kind: 'safezone' }, 'pre2fa', '5m')
    const res = NextResponse.json({ success: true, next: 'otp' })
    res.cookies.set({
      name: 'pre_2fa',
      value: pre2fa,
      httpOnly: true,
      sameSite: 'strict',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 5,
    })
    return res
  } catch (err: any) {
    const isProd = process.env.NODE_ENV === 'production'
    if (isProd) return jsonError('Server misconfiguration', 500)
    return jsonError(`Server misconfiguration (safezone auth DB unavailable: ${err?.message || 'unknown error'})`, 500)
  }
}

