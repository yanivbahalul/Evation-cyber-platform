import { SignJWT, jwtVerify } from 'jose'

function getGatewayIssuer() {
  return 'innotech-gateway'
}

async function getGatewayKey() {
  const secret = process.env.GATEWAY_JWT_SECRET || process.env.JWT_SECRET
  if (!secret) throw new Error('Missing GATEWAY_JWT_SECRET (or JWT_SECRET) for gateway auth')
  return new TextEncoder().encode(secret)
}

export async function signGatewayAuthToken(payload: Record<string, unknown>) {
  const key = await getGatewayKey()
  const now = Math.floor(Date.now() / 1000)
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt(now)
    .setIssuer(getGatewayIssuer())
    .setExpirationTime('8h')
    .sign(key)
}

export async function verifyGatewayAuthToken<T extends Record<string, unknown> = Record<string, unknown>>(
  token: string
) {
  const key = await getGatewayKey()
  const { payload } = await jwtVerify(token, key, {
    algorithms: ['HS256'],
    issuer: getGatewayIssuer(),
  })
  return payload as T & { sub?: string; username?: string; role?: string }
}

