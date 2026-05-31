import { NextResponse, type NextRequest } from 'next/server'
import { verifyJwt, signJwt } from '@/lib/auth/jwt'
import { getAdminModels } from '@/lib/server/adminDb'
import { getSafezoneModels } from '@/lib/server/safezoneDb'
import { signGatewayAuthToken } from '@/lib/auth/gatewayJwt'
import { authJwtExpiresIn, withAuthMaxAge } from '@/lib/auth/cookiePolicy'
import { portalHomePath } from '@/lib/auth/portalAccess'
import { verify } from 'otplib'
import { crypto } from '@otplib/plugin-crypto-noble'
import { base32 } from '@otplib/plugin-base32-scure'
import { decryptTotpSecret, encryptTotpSecret } from '@/lib/security/totpSecretCrypto'

export const runtime = 'nodejs'

function jsonError(message: string, status = 400) {
  return NextResponse.json({ success: false, error: message }, { status })
}

function totpWindow() {
  const raw = process.env.TOTP_WINDOW
  const n = raw ? Number(raw) : 2
  if (!Number.isFinite(n)) return 2
  return Math.max(0, Math.min(10, Math.floor(n)))
}

export async function POST(req: NextRequest) {
  const preToken = req.cookies.get('pre_2fa')?.value
  if (!preToken) return jsonError('Missing pre-2FA session', 401)

  let payload: { sub: string; kind?: 'admin' | 'safezone' }
  try {
    payload = await verifyJwt<{ sub: string; kind?: 'admin' | 'safezone' }>(preToken, 'pre2fa')
  } catch {
    return jsonError('Invalid/expired pre-2FA session', 401)
  }

  let body: { otp?: string }
  try {
    body = await req.json()
  } catch {
    return jsonError('Invalid JSON body')
  }

  const otp = (body.otp ?? '').replace(/\s/g, '')
  if (!/^\d{6}$/.test(otp)) return jsonError('OTP must be 6 digits')

  const kind = payload.kind || 'admin'
  const window = totpWindow()

  // Admin OTP verification → issues admin-panel auth cookie and redirects to '/'
  if (kind === 'admin') {
    const { AdminUser } = await getAdminModels()
    const user = await AdminUser.findOne({ username: payload.sub, isActive: true }).select(
      '+totpSecretEnc +totpSecretIv +totpSecretTag'
    )
    if (!user) return jsonError('2FA not enrolled', 401)

    if ((user as any).role && (user as any).role !== 'admin') {
      return jsonError('No permissions', 403)
    }

    // Backward-compat migration: if older plaintext field exists, encrypt it (in case DB had it).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const legacySecret = (user as any).totpSecret as string | undefined
    if (!user.totpSecretEnc && legacySecret) {
      const enc = await encryptTotpSecret(legacySecret)
      user.totpSecretEnc = enc.ctB64
      user.totpSecretIv = enc.ivB64
      user.totpSecretTag = enc.tagB64
      ;(user as any).totpSecret = undefined
      await user.save()
    }

    if (!user.totpSecretEnc || !user.totpSecretIv || !user.totpSecretTag) {
      return jsonError('2FA not enrolled', 401)
    }

    let secret: string
    try {
      secret = await decryptTotpSecret({
        ctB64: user.totpSecretEnc,
        ivB64: user.totpSecretIv,
        tagB64: user.totpSecretTag,
      })
    } catch {
      return jsonError('2FA secret cannot be decrypted (encryption key changed). Re-enroll 2FA.', 409)
    }

    const result = await verify({ strategy: 'totp', token: otp, secret, window, crypto, base32 })
    const ok = result.valid === true
    if (!ok) return jsonError('Invalid OTP', 401)

    if (!user.totpEnabled) {
      user.totpEnabled = true
      await user.save()
    }

    const auth = await signJwt({ sub: payload.sub }, 'auth', authJwtExpiresIn())

    const gatewayAuth = await signGatewayAuthToken({
      sub: String((user as any)._id),
      username: payload.sub,
      role: 'admin',
    })

    const res = NextResponse.json({ success: true, redirectTo: portalHomePath() })
    res.cookies.set(
      withAuthMaxAge({
        name: 'auth',
        value: gatewayAuth,
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
      }),
    )
    res.cookies.set(
      withAuthMaxAge({
        name: 'admin_auth',
        value: auth,
        httpOnly: true,
        sameSite: 'strict',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
      }),
    )
    res.cookies.set({
      name: 'pre_2fa',
      value: '',
      httpOnly: true,
      sameSite: 'strict',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 0,
    })
    return res
  }

  // Safe Zone OTP verification (unified):
  // Prefer verifying against AdminUser with role=user (encrypted secret), because many demos store employees there.
  // Fallback: verify against the gateway `users` collection (plaintext secret) if configured.
  let gatewaySub = payload.sub
  let gatewayRole: string = 'user'
  let verified = false

  try {
    const { AdminUser } = await getAdminModels()
    const u = await AdminUser.findOne({ username: payload.sub, isActive: true }).select(
      '+totpSecretEnc +totpSecretIv +totpSecretTag'
    )
    if (u && ((u as any).role || 'user') !== 'admin') {
      gatewayRole = (u as any).role || 'user'
      gatewaySub = String((u as any)._id)
      if (!u.totpSecretEnc || !u.totpSecretIv || !u.totpSecretTag) {
        return jsonError('2FA not enrolled', 401)
      }
      const secret = await decryptTotpSecret({
        ctB64: u.totpSecretEnc,
        ivB64: u.totpSecretIv,
        tagB64: u.totpSecretTag,
      })
      const result = await verify({ strategy: 'totp', token: otp, secret, window, crypto, base32 })
      verified = result.valid === true
    }
  } catch {
    // ignore and fall back
  }

  if (!verified) {
    const { User } = await getSafezoneModels()
    const user = await User.findOne({ username: payload.sub, isActive: true }).select('+totpSecret')
    if (!user) return jsonError('Invalid session', 401)
    if (!user.totpEnabled) return jsonError('2FA not enabled for this user', 401)
    const secret = (user as any).totpSecret as string | undefined
    if (!secret) return jsonError('2FA not enrolled', 401)
    const result = await verify({ strategy: 'totp', token: otp, secret, window, crypto, base32 })
    verified = result.valid === true
    if (!verified) return jsonError('Invalid OTP', 401)
    gatewaySub = String((user as any)._id)
    gatewayRole = (user as any).role || 'user'
  }

  const gatewayAuth = await signGatewayAuthToken({
    sub: gatewaySub,
    username: payload.sub,
    role: gatewayRole,
  })

  const res = NextResponse.json({ success: true, redirectTo: portalHomePath() })
  res.cookies.set(
    withAuthMaxAge({
      name: 'auth',
      value: gatewayAuth,
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
    }),
  )
  if (gatewayRole === 'admin') {
    const panelAuth = await signJwt({ sub: payload.sub }, 'auth', authJwtExpiresIn())
    res.cookies.set(
      withAuthMaxAge({
        name: 'admin_auth',
        value: panelAuth,
        httpOnly: true,
        sameSite: 'strict',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
      }),
    )
  } else {
    res.cookies.set({
      name: 'admin_auth',
      value: '',
      httpOnly: true,
      sameSite: 'strict',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 0,
    })
  }
  res.cookies.set({
    name: 'pre_2fa',
    value: '',
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  })
  return res
}

