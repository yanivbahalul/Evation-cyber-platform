import { NextResponse, type NextRequest } from 'next/server'
import { verifyJwt } from '@/lib/auth/jwt'
import { getAdminModels } from '@/lib/server/adminDb'
import { decryptTotpSecret } from '@/lib/security/totpSecretCrypto'
import { verify } from 'otplib'
import { crypto } from '@otplib/plugin-crypto-noble'
import { base32 } from '@otplib/plugin-base32-scure'

export const runtime = 'nodejs'

function jsonError(message: string, status = 400) {
  return NextResponse.json({ success: false, error: message }, { status })
}

export async function POST(req: NextRequest) {
  const token = req.cookies.get('pre_reg')?.value
  if (!token) return jsonError('Missing registration session', 401)

  let payload: { sub: string; passwordHash?: string; totp?: { ctB64: string; ivB64: string; tagB64: string } }
  try {
    payload = await verifyJwt<{
      sub: string
      passwordHash?: string
      totp?: { ctB64: string; ivB64: string; tagB64: string }
    }>(token, 'prereg')
  } catch {
    return jsonError('Invalid/expired registration session', 401)
  }

  let body: { otp?: string }
  try {
    body = await req.json()
  } catch {
    return jsonError('Invalid JSON body')
  }

  const otp = (body.otp ?? '').replace(/\s/g, '')
  if (!/^\d{6}$/.test(otp)) return jsonError('OTP must be 6 digits')

  if (!payload.passwordHash || !payload.totp?.ctB64 || !payload.totp?.ivB64 || !payload.totp?.tagB64) {
    return jsonError('Invalid registration session', 401)
  }

  const secret = await decryptTotpSecret({
    ctB64: payload.totp.ctB64,
    ivB64: payload.totp.ivB64,
    tagB64: payload.totp.tagB64,
  })

  const result = await verify({ strategy: 'totp', token: otp, secret, window: 1, crypto, base32 })
  if (result.valid !== true) return jsonError('Invalid OTP', 401)

  const { AdminUser } = await getAdminModels()
  const existing = await AdminUser.findOne({ username: payload.sub }).lean()
  if (existing) return jsonError('Username already exists', 409)

  await AdminUser.create({
    username: payload.sub,
    passwordHash: payload.passwordHash,
    isActive: true,
    role: 'user',
    totpSecretEnc: payload.totp.ctB64,
    totpSecretIv: payload.totp.ivB64,
    totpSecretTag: payload.totp.tagB64,
    totpEnabled: true,
  })

  const res = NextResponse.json({ success: true })
  res.cookies.set({
    name: 'pre_reg',
    value: '',
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  })
  return res
}

