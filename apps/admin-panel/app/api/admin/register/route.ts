import { NextResponse, type NextRequest } from 'next/server'
import { getAdminModels } from '@/lib/server/adminDb'
import * as QRCode from 'qrcode'
import { signJwt } from '@/lib/auth/jwt'
import { generateSecret, generateURI } from 'otplib'
import { crypto } from '@otplib/plugin-crypto-noble'
import { base32 } from '@otplib/plugin-base32-scure'
import { encryptTotpSecret } from '@/lib/security/totpSecretCrypto'
// eslint-disable-next-line @typescript-eslint/no-var-requires
const bcrypt = require('bcryptjs')

export const runtime = 'nodejs'

function jsonError(message: string, status = 400) {
  return NextResponse.json({ success: false, error: message }, { status })
}

export async function POST(req: NextRequest) {
  // Disabled by default for safety (enable only in dev/labs).
  const enabled = process.env.ALLOW_ADMIN_SELF_REGISTER === 'true'
  if (!enabled) return jsonError('Registration disabled', 403)

  let body: { username?: string; password?: string }
  try {
    body = await req.json()
  } catch {
    return jsonError('Invalid JSON body')
  }

  const username = (body.username ?? '').trim()
  const password = body.password ?? ''

  if (!/^[a-zA-Z0-9._-]{3,64}$/.test(username)) {
    return jsonError('Username must be 3–64 chars (letters, numbers, ., _, -)', 400)
  }
  if (password.length < 8 || password.length > 200) {
    return jsonError('Password must be 8–200 chars', 400)
  }

  const { AdminUser } = await getAdminModels()
  const existing = await AdminUser.findOne({ username }).lean()
  if (existing) return jsonError('Username already exists', 409)

  const passwordHash = await bcrypt.hash(password, 12)
  const secret = generateSecret({ crypto, base32 })
  const enc = await encryptTotpSecret(secret)

  const prereg = await signJwt(
    {
      sub: username,
      passwordHash,
      totp: { ctB64: enc.ctB64, ivB64: enc.ivB64, tagB64: enc.tagB64 },
    },
    'prereg',
    '10m'
  )
  const issuer = process.env.TOTP_ISSUER_NAME || 'InnoTech HoneyNet'
  const otpauth = generateURI({ strategy: 'totp', issuer, label: username, secret })
  const qrDataUrl = await QRCode.toDataURL(otpauth, { margin: 1, scale: 6 })

  const res = NextResponse.json({ success: true, data: { qrDataUrl, secret } })
  res.cookies.set({
    name: 'pre_reg',
    value: prereg,
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 10,
  })
  return res
}

