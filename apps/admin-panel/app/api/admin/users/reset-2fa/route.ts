import { NextResponse, type NextRequest } from 'next/server'
import * as QRCode from 'qrcode'
import { requireAdmin } from '@/lib/auth/requireAdmin'
import { getSafezoneModels } from '@/lib/server/safezoneDb'
import { generateSecret, generateURI } from 'otplib'
import { crypto } from '@otplib/plugin-crypto-noble'
import { base32 } from '@otplib/plugin-base32-scure'

export const runtime = 'nodejs'

function jsonError(message: string, status = 400) {
  return NextResponse.json({ success: false, error: message }, { status })
}

export async function POST(req: NextRequest) {
  try {
    await requireAdmin(req)
    const body = (await req.json().catch(() => null)) as { username?: string } | null
    if (!body) return jsonError('Invalid JSON body')
    const username = (body.username ?? '').trim()
    if (!username) return jsonError('Missing username')

    const { User } = await getSafezoneModels()
    const user = await User.findOne({ username, isActive: true })
    if (!user) return jsonError('User not found', 404)

    const secret = generateSecret({ crypto, base32 })
    user.totpSecret = secret
    user.totpEnabled = false
    await user.save()

    const issuer = process.env.TOTP_ISSUER_NAME || 'InnoTech HoneyNet'
    const otpauth = generateURI({ strategy: 'totp', issuer, label: username, secret })
    const qrDataUrl = await QRCode.toDataURL(otpauth, { margin: 1, scale: 6 })

    return NextResponse.json({ success: true, data: { qrDataUrl, secret } })
  } catch (e: any) {
    if (e?.message === 'missing_auth') return jsonError('Unauthorized', 401)
    if (String(e?.message).includes('forbidden')) return jsonError('Forbidden', 403)
    return jsonError('Failed to reset 2FA', 500)
  }
}
