import { generateSecret, generateURI, verify } from 'otplib'
import { crypto } from '@otplib/plugin-crypto-noble'
import { base32 } from '@otplib/plugin-base32-scure'
import { promises as fs } from 'node:fs'
import path from 'node:path'

const TOTP_ISSUER = 'InnoTech HoneyNet'

export async function getTotpSecret() {
  // Prefer env override.
  if (process.env.ADMIN_TOTP_SECRET) return process.env.ADMIN_TOTP_SECRET

  // Otherwise persist locally (gitignored). TOTP secrets must be base32.
  const dir = path.join(process.cwd(), '.local')
  const filePath = path.join(dir, 'admin-totp-secret')
  await fs.mkdir(dir, { recursive: true })

  try {
    const existing = (await fs.readFile(filePath, 'utf8')).trim()
    if (existing) return existing
  } catch {
    // ignore
  }

  const secret = generateSecret({ crypto, base32 })
  await fs.writeFile(filePath, secret, { encoding: 'utf8', mode: 0o600 })
  return secret
}

export async function createEnrollment(username: string) {
  const secret = await getTotpSecret()
  const otpauth = generateURI({
    strategy: 'totp',
    issuer: TOTP_ISSUER,
    label: username,
    secret,
  })
  return { secret, otpauth, issuer: TOTP_ISSUER }
}

export async function verifyTotp(code: string) {
  const secret = await getTotpSecret()
  const result = await verify({ strategy: 'totp', token: code, secret, window: 1, crypto, base32 })
  return result.valid === true
}

