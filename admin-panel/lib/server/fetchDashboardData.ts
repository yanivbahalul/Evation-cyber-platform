/* eslint-disable @typescript-eslint/no-explicit-any */
import { getTelemetryModels } from '@/lib/server/telemetryDb'
import { mapAttackEventDoc, mapAttackerProfileDoc } from '@/lib/server/mapAttackEvent'

function mapHoneyTokens(tokens: any[]) {
  return tokens.map((t) => ({
    _id: String(t._id),
    catalogId: t.catalogId,
    fakeUsername: t.fakeUsername,
    fakePassword: t.fakePassword,
    tokenType: t.tokenType,
    service: t.service,
    scopes: Array.isArray(t.scopes) ? t.scopes : [],
    leakSource: t.leakSource,
    isTriggered: Boolean(t.isTriggered),
    triggeredLogs: (t.triggeredLogs ?? []).map((l: any) => ({
      attackerIp: l.attackerIp,
      timestamp: (l.timestamp instanceof Date ? l.timestamp : new Date(l.timestamp)).toISOString(),
      networkContext: l.networkContext,
      method: l.method,
      path: l.path,
      userAgent: l.userAgent,
      outcome: typeof l.outcome === 'number' ? l.outcome : undefined,
      traceId: l.traceId,
    })),
  }))
}

export const DASHBOARD_EVENTS_LIMIT_MAX = 500
export const DASHBOARD_PROFILES_LIMIT = 500
export const DASHBOARD_HONEY_TOKENS_LIMIT = 200

export async function fetchDashboardData(eventsLimit = 200) {
  const eventsCap = Math.min(eventsLimit, DASHBOARD_EVENTS_LIMIT_MAX)
  const { AttackEvent, AttackerProfile, HoneyToken } = await getTelemetryModels()

  const [events, profiles, tokens] = await Promise.all([
    AttackEvent.find().sort({ timestamp: -1 }).limit(eventsCap).lean(),
    AttackerProfile.find().sort({ riskScore: -1 }).limit(DASHBOARD_PROFILES_LIMIT).lean(),
    HoneyToken.find().sort({ _id: -1 }).limit(DASHBOARD_HONEY_TOKENS_LIMIT).lean(),
  ])

  return {
    events: events.map((e: Record<string, unknown>) => mapAttackEventDoc(e)),
    profiles: profiles.map((p: Record<string, unknown>) => mapAttackerProfileDoc(p)),
    honeyTokens: mapHoneyTokens(tokens),
  }
}
