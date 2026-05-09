import crypto from 'node:crypto'
import { readOrCreateLocalSecret } from '@/lib/auth/localSecrets'

let cachedKey: Buffer | null = null

async function getKey() {
  // Highest priority: explicit env var (prod-friendly).
  const b64 = process.env.ADMIN_TOTP_ENC_KEY_BASE64
  const raw = b64 || (await readOrCreateLocalSecret('admin-totp-enc-key', 32))

  // `readOrCreateLocalSecret` returns base64url; env var is expected base64.
  // Normalize by accepting either encoding.
  let buf: Buffer
  try {
    buf = Buffer.from(raw, 'base64')
  } catch {
    buf = Buffer.from(raw, 'base64url' as any)
  }

  if (buf.length !== 32) {
    throw new Error('Admin TOTP encryption key must be 32 bytes (base64/base64url)')
  }
  return buf
}

export async function encryptTotpSecret(secret: string) {
  if (!cachedKey) cachedKey = await getKey()
  const key = cachedKey
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  const ciphertext = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()

  return {
    ivB64: iv.toString('base64'),
    ctB64: ciphertext.toString('base64'),
    tagB64: tag.toString('base64'),
  }
}

export async function decryptTotpSecret(payload: { ivB64: string; ctB64: string; tagB64: string }) {
  if (!cachedKey) cachedKey = await getKey()
  const key = cachedKey
  const iv = Buffer.from(payload.ivB64, 'base64')
  const ct = Buffer.from(payload.ctB64, 'base64')
  const tag = Buffer.from(payload.tagB64, 'base64')

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(tag)
  const plaintext = Buffer.concat([decipher.update(ct), decipher.final()])
  return plaintext.toString('utf8')
}

