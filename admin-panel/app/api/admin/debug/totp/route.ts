import { NextResponse, type NextRequest } from 'next/server'
import { getAdminModels } from '@/lib/server/adminDb'
import { decryptTotpSecret } from '@/lib/security/totpSecretCrypto'
import { generate, verify } from 'otplib'
import { crypto } from '@otplib/plugin-crypto-noble'
import { base32 } from '@otplib/plugin-base32-scure'

export const runtime = 'nodejs'

export const GET = async (req: NextRequest) => {
  if (process.env.NODE_ENV === 'production') return NextResponse.json({ success: false }, { status: 404 })
  if (process.env.DEBUG_TOTP !== 'true') return NextResponse.json({ success: false }, { status: 404 })

  const username = (req.nextUrl.searchParams.get('username') || '').trim()
  if (!username) return NextResponse.json({ success: false, error: 'Missing username' }, { status: 400 })

  const { AdminUser } = await getAdminModels()
  const adminUser = await AdminUser.findOne({ username, isActive: true }).select(
    '+totpSecretEnc +totpSecretIv +totpSecretTag'
  )
  if (!adminUser || !adminUser.totpEnabled) {
    return NextResponse.json({ success: false, error: 'User not found or 2FA not enabled' }, { status: 404 })
  }
  if (!adminUser.totpSecretEnc || !adminUser.totpSecretIv || !adminUser.totpSecretTag) {
    return NextResponse.json({ success: false, error: '2FA not enrolled' }, { status: 400 })
  }

  const secret = await decryptTotpSecret({
    ctB64: adminUser.totpSecretEnc,
    ivB64: adminUser.totpSecretIv,
    tagB64: adminUser.totpSecretTag,
  })
  const code = await generate({ strategy: 'totp', secret, window: 1, crypto, base32 })
  const check = await verify({ strategy: 'totp', token: code, secret, window: 1, crypto, base32 })

  return NextResponse.json({
    success: true,
    username,
    code,
    valid: (check as any)?.valid === true,
    // fingerprint the decrypted secret without leaking it
    secretPrefix: secret.slice(0, 4),
    secretLen: secret.length,
  })
}

