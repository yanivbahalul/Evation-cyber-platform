import { jwtVerify } from 'jose'

const HONEYNET_ISSUER = 'innotech-honeynet'
const GATEWAY_ISSUER = 'innotech-gateway'

function honeynetKey(): Uint8Array | null {
  const secret = process.env.JWT_SECRET
  if (!secret) return null
  return new TextEncoder().encode(secret)
}

function gatewayKey(): Uint8Array | null {
  const secret = process.env.GATEWAY_JWT_SECRET || process.env.JWT_SECRET
  if (!secret) return null
  return new TextEncoder().encode(secret)
}

/** Edge-safe admin_auth verification (env secret only — no filesystem). */
export async function verifyAdminAuthEdge(token: string): Promise<{ sub?: string } | null> {
  const key = honeynetKey()
  if (!key) return null
  try {
    const { payload } = await jwtVerify(token, key, { issuer: HONEYNET_ISSUER })
    if (payload.purpose !== 'auth') return null
    return { sub: typeof payload.sub === 'string' ? payload.sub : undefined }
  } catch {
    return null
  }
}

/** Edge-safe gateway `auth` cookie verification. */
export async function verifyGatewayAuthEdge(
  token: string
): Promise<{ sub?: string; username?: string; role?: string } | null> {
  const key = gatewayKey()
  if (!key) return null
  try {
    const { payload } = await jwtVerify(token, key, {
      algorithms: ['HS256'],
      issuer: GATEWAY_ISSUER,
    })
    return {
      sub: typeof payload.sub === 'string' ? payload.sub : undefined,
      username: typeof payload.username === 'string' ? payload.username : undefined,
      role: typeof payload.role === 'string' ? payload.role : undefined,
    }
  } catch {
    return null
  }
}
