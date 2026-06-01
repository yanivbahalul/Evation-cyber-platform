import type { NextRequest } from 'next/server'
import {
  isLoopback,
  normalizeIp,
  parseForwardedChain,
} from '@evation/shared-utils'

/**
 * Client IP for the browser tab hitting the UI (before /gateway rewrite).
 * Prefers LAN/public; uses 127.0.0.1 when the tab is on localhost; "unknown" only with no signal.
 */
export function resolveMiddlewareClientIp(req: NextRequest): string {
  const candidates: string[] = []

  const cf = req.headers.get('cf-connecting-ip')
  if (cf) candidates.push(cf)

  candidates.push(...parseForwardedChain(req.headers.get('x-forwarded-for') ?? ''))

  const xri = req.headers.get('x-real-ip')
  if (xri) candidates.push(xri)

  // Next.js may expose the peer address in Node middleware / some hosts
  const nextIp = (req as NextRequest & { ip?: string }).ip
  if (nextIp) candidates.push(nextIp)

  const socketIp = (req as NextRequest & { socket?: { remoteAddress?: string } }).socket
    ?.remoteAddress
  if (socketIp) candidates.push(socketIp)

  for (const raw of candidates) {
    const ip = normalizeIp(raw)
    if (ip && !isLoopback(ip)) return ip
  }

  const fallback = candidates.map((raw) => normalizeIp(raw)).find(Boolean)
  return fallback || 'unknown'
}

export function applyGatewayClientIpHeaders(
  req: NextRequest,
  headers: Headers,
): Headers {
  const clientIp = resolveMiddlewareClientIp(req)
  if (!clientIp || clientIp === 'unknown') return headers

  const existing = req.headers.get('x-forwarded-for')
  const chain = parseForwardedChain(existing ?? '')
  if (!chain.includes(clientIp)) {
    headers.set('x-forwarded-for', existing ? `${clientIp}, ${existing}` : clientIp)
  } else if (existing) {
    headers.set('x-forwarded-for', existing)
  } else {
    headers.set('x-forwarded-for', clientIp)
  }

  headers.set('x-real-ip', clientIp)
  headers.set('x-client-ip', clientIp)
  return headers
}
