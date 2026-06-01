import { SignJWT, jwtVerify } from 'jose'
import { readOrCreateLocalSecret } from './localSecrets'

type JwtPurpose = 'pre2fa' | 'auth' | 'prereg'

function getIssuer() {
  return 'innotech-honeynet'
}

async function getJwtKey() {
  const secret = process.env.JWT_SECRET || (await readOrCreateLocalSecret('jwt-secret'))
  return new TextEncoder().encode(secret)
}

export async function signJwt(payload: Record<string, unknown>, purpose: JwtPurpose, expiresIn: string) {
  const key = await getJwtKey()
  const now = Math.floor(Date.now() / 1000)
  return new SignJWT({ ...payload, purpose })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt(now)
    .setIssuer(getIssuer())
    .setExpirationTime(expiresIn)
    .sign(key)
}

export async function verifyJwt<TPayload extends Record<string, unknown>>(token: string, purpose: JwtPurpose) {
  const key = await getJwtKey()
  const { payload } = await jwtVerify(token, key, { issuer: getIssuer() })
  if (payload.purpose !== purpose) throw new Error('invalid_token_purpose')
  return payload as unknown as TPayload & { purpose: JwtPurpose }
}

