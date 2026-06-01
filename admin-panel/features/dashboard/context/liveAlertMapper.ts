import type { AttackEvent, LiveAlert } from '@/lib/types/telemetry'
import { normalizeTrapType } from '@/lib/attackIntel'

export function randomEventId(): string {
  const c = globalThis.crypto
  if (c && typeof c.randomUUID === 'function') return c.randomUUID()
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 11)}`
}

export function liveAlertToAttackEvent(a: LiveAlert): AttackEvent {
  return {
    eventID: a.eventID,
    attackerIp: a.attackerIp,
    trapType: a.trapType,
    payload: a.payload,
    wasted_time_ms: a.wastedTimeMs ?? a.wasted_time_ms ?? 0,
    bytes_sent: a.bytesSent ?? a.bytes_sent ?? 0,
    timestamp: a.timestamp,
    traceId: a.traceId,
    method: a.method,
    path: a.path,
    userAgent: a.userAgent,
    referer: a.referer,
    fingerprint: a.fingerprint,
    handoffFrom: a.handoffFrom,
    xssTier: a.xssTier,
    secondaryTraps: a.secondaryTraps,
  }
}

function isAfterClear(timestamp: string, clearedAtMs: number): boolean {
  if (!clearedAtMs) return true
  const ts = new Date(timestamp).getTime()
  return Number.isFinite(ts) ? ts >= clearedAtMs : true
}

/** Merge socket live alerts with polled events; live wins on duplicate eventID. */
export function mergeAttackEvents(
  live: LiveAlert[],
  polled: AttackEvent[],
  options?: { clearedAtMs?: number },
): AttackEvent[] {
  const clearedAtMs = options?.clearedAtMs ?? 0
  const seen = new Set<string>()
  const out: AttackEvent[] = []

  for (const a of live) {
    const id = a?.eventID?.trim()
    if (!id || seen.has(id)) continue
    if (!isAfterClear(a.timestamp, clearedAtMs)) continue
    seen.add(id)
    out.push(liveAlertToAttackEvent(a))
  }

  for (const e of polled) {
    const id = e?.eventID?.trim()
    if (!id || seen.has(id)) continue
    if (!isAfterClear(e.timestamp, clearedAtMs)) continue
    seen.add(id)
    out.push(e)
  }

  return out.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  )
}

/** Normalize a raw socket `liveAlert` payload into the dashboard's LiveAlert shape. */
export function mapSocketLiveAlert(data: Record<string, unknown>): LiveAlert | null {
  const eventID = typeof data.eventID === 'string' ? data.eventID.trim() : ''
  if (!eventID) return null
  const trapType = normalizeTrapType(String(data.trapType ?? 'DATA_BOMB'))
  const fingerprint = (data.fingerprint as LiveAlert['fingerprint']) ?? {}
  const latRaw = typeof data.lat === 'number' || typeof data.lat === 'string' ? Number(data.lat) : NaN
  const lngRaw = typeof data.lng === 'number' || typeof data.lng === 'string' ? Number(data.lng) : NaN
  const ts =
    typeof data.timestamp === 'string'
      ? data.timestamp
      : typeof data.timestamp === 'number'
        ? new Date(data.timestamp).toISOString()
        : new Date().toISOString()

  return {
    eventID,
    trapType,
    attackerIp: String(data.attackerIp ?? 'unknown'),
    city: String(data.city ?? 'Unknown'),
    country: typeof data.country === 'string' ? data.country : undefined,
    countryCode: typeof data.countryCode === 'string' ? data.countryCode : undefined,
    geoSource: typeof data.geoSource === 'string' ? data.geoSource : undefined,
    geoPrecision: typeof data.geoPrecision === 'string' ? data.geoPrecision : undefined,
    lat: Number.isFinite(latRaw) ? latRaw : 0,
    lng: Number.isFinite(lngRaw) ? lngRaw : 0,
    os: String(fingerprint?.os ?? data.os ?? 'unknown'),
    browser: String(fingerprint?.browserVersion ?? fingerprint?.browser ?? data.browser ?? 'unknown'),
    riskScore: Number.isFinite(fingerprint?.riskScore) ? Number(fingerprint.riskScore) : undefined,
    wastedTimeMs: Number.isFinite(data.wasted_time_ms)
      ? Number(data.wasted_time_ms)
      : Number.isFinite(data.wastedTimeMs)
        ? Number(data.wastedTimeMs)
        : 0,
    wasted_time_ms: Number.isFinite(data.wasted_time_ms)
      ? Number(data.wasted_time_ms)
      : Number.isFinite(data.wastedTimeMs)
        ? Number(data.wastedTimeMs)
        : 0,
    bytesSent: Number.isFinite(data.bytes_sent)
      ? Number(data.bytes_sent)
      : Number.isFinite(data.bytesSent)
        ? Number(data.bytesSent)
        : undefined,
    bytes_sent: Number.isFinite(data.bytes_sent)
      ? Number(data.bytes_sent)
      : Number.isFinite(data.bytesSent)
        ? Number(data.bytesSent)
        : 0,
    timestamp: ts,
    payload: typeof data.payload === 'string' ? data.payload : undefined,
    traceId: typeof data.traceId === 'string' ? data.traceId : undefined,
    method: typeof data.method === 'string' ? data.method : undefined,
    path: typeof data.path === 'string' ? data.path : undefined,
    userAgent: typeof data.userAgent === 'string' ? data.userAgent : undefined,
    referer: typeof data.referer === 'string' ? data.referer : undefined,
    fingerprint: Object.keys(fingerprint).length ? fingerprint : undefined,
    handoffFrom: typeof data.handoffFrom === 'string' ? data.handoffFrom : undefined,
    xssTier: typeof data.xssTier === 'string' ? data.xssTier : undefined,
    secondaryTraps: Array.isArray(data.secondaryTraps) ? data.secondaryTraps.map(String) : undefined,
  }
}
