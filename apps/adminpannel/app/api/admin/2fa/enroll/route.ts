import { NextResponse, type NextRequest } from 'next/server'
import * as QRCode from 'qrcode'
import { verifyJwt } from '@/lib/auth/jwt'
import { getAdminModels } from '@/lib/server/adminDb'
import { generateSecret, generateURI } from 'otplib'
import { crypto } from '@otplib/plugin-crypto-noble'
import { base32 } from '@otplib/plugin-base32-scure'
import { decryptTotpSecret, encryptTotpSecret } from '@/lib/security/totpSecretCrypto'

export const runtime = 'nodejs'

function jsonError(message: string, status = 400) {
  return NextResponse.json({ success: false, error: message }, { status })
}

export async function GET(req: NextRequest) {
  const token = req.cookies.get('pre_2fa')?.value
  if (!token) return jsonError('Missing pre-2FA session', 401)

  let payload: { sub: string }
  try {
    payload = await verifyJwt<{ sub: string }>(token, 'pre2fa')
  } catch {
    return jsonError('Invalid/expired pre-2FA session', 401)
  }

  const { AdminUser } = await getAdminModels()
  const user = await AdminUser.findOne({ username: payload.sub, isActive: true }).select(
    '+totpSecretEnc +totpSecretIv +totpSecretTag'
  )
  if (!user) return jsonError('Unknown admin user', 404)

  let secret: string | null = null
  if (user.totpSecretEnc && user.totpSecretIv && user.totpSecretTag) {
    try {
      secret = await decryptTotpSecret({
        ctB64: user.totpSecretEnc,
        ivB64: user.totpSecretIv,
        tagB64: user.totpSecretTag,
      })
    } catch {
      // Key changed or corrupted secret: rotate secret.
      secret = null
    }
  } else {
    // Generate & store encrypted secret
    secret = generateSecret({ crypto, base32 })
    const enc = encryptTotpSecret(secret)
    user.totpSecretEnc = enc.ctB64
    user.totpSecretIv = enc.ivB64
    user.totpSecretTag = enc.tagB64
    await user.save()
  }

  if (!secret) {
    secret = generateSecret({ crypto, base32 })
    const enc = await encryptTotpSecret(secret)
    user.totpSecretEnc = enc.ctB64
    user.totpSecretIv = enc.ivB64
    user.totpSecretTag = enc.tagB64
    user.totpEnabled = false
    await user.save()
  }

  const issuer = process.env.TOTP_ISSUER_NAME || 'InnoTech HoneyNet'
  const otpauth = generateURI({
    strategy: 'totp',
    issuer,
    label: payload.sub,
    secret,
  })
  const qrDataUrl = await QRCode.toDataURL(otpauth, { margin: 1, scale: 6 })

  return NextResponse.json({
    success: true,
    data: {
      issuer,
      account: payload.sub,
      otpauth,
      qrDataUrl,
      // For manual entry into Google Authenticator.
      secret,
    },
  })
}

