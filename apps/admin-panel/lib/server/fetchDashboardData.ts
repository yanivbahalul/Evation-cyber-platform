/* eslint-disable @typescript-eslint/no-explicit-any */
import { getTelemetryModels } from '@/lib/server/telemetryDb'
import { mapAttackEventDoc, mapAttackerProfileDoc } from '@/lib/server/mapAttackEvent'

function mapHoneyTokens(tokens: any[]) {
  return tokens.map((t) => ({
    _id: String(t._id),
    fakeUsername: t.fakeUsername,
    fakePassword: t.fakePassword,
    isTriggered: Boolean(t.isTriggered),
    triggeredLogs: (t.triggeredLogs ?? []).map((l: any) => ({
      attackerIp: l.attackerIp,
      timestamp: (l.timestamp instanceof Date ? l.timestamp : new Date(l.timestamp)).toISOString(),
      networkContext: l.networkContext,
    })),
  }))
}

export async function fetchDashboardData(eventsLimit = 200) {
  const limit = Math.min(eventsLimit, 500)
  const { AttackEvent, AttackerProfile, HoneyToken } = await getTelemetryModels()

  const [events, profiles, tokens] = await Promise.all([
    AttackEvent.find().sort({ timestamp: -1 }).limit(limit).lean(),
    AttackerProfile.find().sort({ riskScore: -1 }).lean(),
    HoneyToken.find().lean(),
  ])

  return {
    events: events.map((e: Record<string, unknown>) => mapAttackEventDoc(e)),
    profiles: profiles.map((p: Record<string, unknown>) => mapAttackerProfileDoc(p)),
    honeyTokens: mapHoneyTokens(tokens),
  }
}
