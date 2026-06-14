import { NextResponse, type NextRequest } from 'next/server'
import { toDataURL } from 'qrcode'
import { verifyJwt } from '@/lib/auth/jwt'
import { jsonError } from '@/lib/server/apiResponse'
import { getAdminModels } from '@/lib/server/adminDb'
import { generateSecret, generateURI } from 'otplib'
import { crypto } from '@otplib/plugin-crypto-noble'
import { base32 } from '@otplib/plugin-base32-scure'
import { decryptTotpSecret, encryptTotpSecret } from '@/lib/security/totpSecretCrypto'

export const runtime = 'nodejs'

type AdminUserDoc = {
  totpSecretEnc?: string | null
  totpSecretIv?: string | null
  totpSecretTag?: string | null
  totpEnabled?: boolean
  save: () => Promise<unknown>
}

const persistNewSecret = async (user: AdminUserDoc, resetEnabled = false) => {
  const newSecret = generateSecret({ crypto, base32 })
  const enc = await encryptTotpSecret(newSecret)
  user.totpSecretEnc = enc.ctB64
  user.totpSecretIv = enc.ivB64
  user.totpSecretTag = enc.tagB64
  if (resetEnabled) user.totpEnabled = false
  await user.save()
  return newSecret
}

const resolveTotpSecret = async (user: AdminUserDoc): Promise<string> => {
  if (user.totpSecretEnc && user.totpSecretIv && user.totpSecretTag) {
    try {
      return await decryptTotpSecret({
        ctB64: user.totpSecretEnc,
        ivB64: user.totpSecretIv,
        tagB64: user.totpSecretTag,
      })
    } catch {
      // Key changed or corrupted secret: rotate secret.
    }
  } else {
    return persistNewSecret(user)
  }
  return persistNewSecret(user, true)
}

export const GET = async (req: NextRequest) => {
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

  const secret = await resolveTotpSecret(user as AdminUserDoc)
  const issuer = process.env.TOTP_ISSUER_NAME || 'InnoTech HoneyNet'
  const otpauth = generateURI({
    strategy: 'totp',
    issuer,
    label: payload.sub,
    secret,
  })
  const qrDataUrl = await toDataURL(otpauth, { margin: 1, scale: 6 })

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
