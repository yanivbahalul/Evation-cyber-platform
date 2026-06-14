import type { AttackEvent, MlEnrichment, MlSeverity } from '@/lib/types/telemetry'
import { uniqueTraceIds } from '@/lib/attackIntel'

function num(v: unknown): number | undefined {
  return v != null && Number.isFinite(Number(v)) ? Number(v) : undefined
}

function str(v: unknown): string | undefined {
  return v != null ? String(v) : undefined
}

function mapMlEnrichment(raw: unknown): MlEnrichment | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const m = raw as Record<string, unknown>
  const payload = m.payload as Record<string, unknown> | undefined
  const log = m.log as Record<string, unknown> | undefined
  const mitre = m.mitre as Record<string, unknown> | undefined
  const actor = m.threatActor as Record<string, unknown> | undefined

  return {
    riskScore: num(m.riskScore),
    severity: str(m.severity) as MlSeverity | undefined,
    engine: str(m.engine) as MlEnrichment['engine'],
    payload: payload
      ? {
          label: str(payload.label),
          attackType: str(payload.attackType),
          confidence: num(payload.confidence),
          model: str(payload.model),
        }
      : undefined,
    log: log
      ? { label: str(log.label), confidence: num(log.confidence), model: str(log.model) }
      : undefined,
    mitre: mitre
      ? {
          tactic: str(mitre.tactic),
          tacticConfidence: num(mitre.tacticConfidence),
          techniques: Array.isArray(mitre.techniques)
            ? (mitre.techniques as Record<string, unknown>[]).map((t) => ({
                id: String(t.id ?? ''),
                name: String(t.name ?? ''),
                tactic: String(t.tactic ?? ''),
                score: num(t.score) ?? 0,
              }))
            : undefined,
          model: str(mitre.model),
        }
      : undefined,
    threatActor: actor
      ? {
          group: str(actor.group),
          confidence: num(actor.confidence),
          candidates: Array.isArray(actor.candidates)
            ? (actor.candidates as Record<string, unknown>[]).map((c) => ({
                group: String(c.group ?? ''),
                score: num(c.score) ?? 0,
              }))
            : undefined,
          model: str(actor.model),
        }
      : undefined,
    styleSignature: str(m.styleSignature),
    modelsUsed: Array.isArray(m.modelsUsed) ? m.modelsUsed.map(String) : undefined,
    computedAt: m.computedAt
      ? (m.computedAt instanceof Date ? m.computedAt : new Date(String(m.computedAt))).toISOString()
      : undefined,
  }
}

export function mapAttackEventDoc(e: Record<string, unknown>): AttackEvent {
  const ts = e.timestamp instanceof Date ? e.timestamp : new Date(String(e.timestamp ?? Date.now()))
  const fp = e.fingerprint as Record<string, unknown> | undefined
  return {
    eventID: String(e.eventID ?? ''),
    attackerIp: String(e.attackerIp ?? ''),
    trapType: String(e.trapType ?? 'RECON') as AttackEvent['trapType'],
    payload: e.payload != null ? String(e.payload) : undefined,
    wasted_time_ms: Number(e.wasted_time_ms ?? 0),
    bytes_sent: Number(e.bytes_sent ?? 0),
    timestamp: ts.toISOString(),
    traceId: e.traceId != null ? String(e.traceId) : undefined,
    method: e.method != null ? String(e.method) : undefined,
    path: e.path != null ? String(e.path) : undefined,
    userAgent: e.userAgent != null ? String(e.userAgent) : undefined,
    referer: e.referer != null ? String(e.referer) : undefined,
    fingerprint: fp
      ? {
          os: fp.os != null ? String(fp.os) : undefined,
          platform: fp.platform != null ? String(fp.platform) : undefined,
          browser: fp.browser != null ? String(fp.browser) : undefined,
          browserVersion: fp.browserVersion != null ? String(fp.browserVersion) : undefined,
          deviceType: fp.deviceType != null ? String(fp.deviceType) : undefined,
          isBot: Boolean(fp.isBot),
          riskScore: Number.isFinite(fp.riskScore) ? Number(fp.riskScore) : undefined,
        }
      : undefined,
    handoffFrom: e.handoffFrom != null ? String(e.handoffFrom) : undefined,
    xssTier: e.xssTier != null ? String(e.xssTier) : undefined,
    secondaryTraps: Array.isArray(e.secondaryTraps)
      ? e.secondaryTraps.map(String)
      : undefined,
    mlEnrichment: mapMlEnrichment(e.mlEnrichment),
  }
}

export function mapAttackerProfileDoc(p: Record<string, unknown>) {
  return {
    ip: String(p.ip ?? ''),
    city: p.city != null ? String(p.city) : '—',
    country: p.country != null ? String(p.country) : undefined,
    countryCode: p.countryCode != null ? String(p.countryCode) : undefined,
    lat: p.lat != null ? Number(p.lat) : 0,
    lng: p.lng != null ? Number(p.lng) : 0,
    isp: p.isp != null ? String(p.isp) : undefined,
    geoSource: p.geoSource != null ? String(p.geoSource) : undefined,
    geoPrecision: p.geoPrecision != null ? String(p.geoPrecision) : undefined,
    os: p.os != null ? String(p.os) : '—',
    platform: p.platform != null ? String(p.platform) : undefined,
    browser: p.browser != null ? String(p.browser) : '—',
    deviceType: p.deviceType != null ? String(p.deviceType) : undefined,
    isBot: Boolean(p.isBot),
    riskScore: Number(p.riskScore ?? 0),
    firstSeen: (p.firstSeen instanceof Date ? p.firstSeen : new Date(String(p.firstSeen))).toISOString(),
    lastSeen: (p.lastSeen instanceof Date ? p.lastSeen : new Date(String(p.lastSeen))).toISOString(),
    traceIds: uniqueTraceIds(Array.isArray(p.traceIds) ? p.traceIds.map(String) : []),
    banned: Boolean(p.banned),
    bannedAt: p.bannedAt
      ? (p.bannedAt instanceof Date ? p.bannedAt : new Date(String(p.bannedAt))).toISOString()
      : undefined,
    bannedBy: p.bannedBy != null ? String(p.bannedBy) : undefined,
    mlRiskScore: num(p.mlRiskScore),
    mlSeverity: str(p.mlSeverity) as MlSeverity | undefined,
    mlTactics: Array.isArray(p.mlTactics) ? p.mlTactics.map(String) : undefined,
    mlThreatActor: str(p.mlThreatActor),
    mlThreatActorConfidence: num(p.mlThreatActorConfidence),
    mlStyleSignatures: Array.isArray(p.mlStyleSignatures) ? p.mlStyleSignatures.map(String) : undefined,
    mlModelsUsed: Array.isArray(p.mlModelsUsed) ? p.mlModelsUsed.map(String) : undefined,
  }
}
