import { NextResponse, type NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/auth/requireAdmin'
import { getTelemetryModels } from '@/lib/server/telemetryDb'
import { DASHBOARD_HONEY_TOKENS_LIMIT } from '@/lib/server/fetchDashboardData'

export const runtime = 'nodejs'

function jsonError(message: string, status = 400) {
  return NextResponse.json({ success: false, error: message }, { status })
}

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req)
  } catch {
    return jsonError('Unauthorized', 401)
  }

  try {
    const { HoneyToken } = await getTelemetryModels()
    const tokens = await HoneyToken.find()
      .sort({ _id: -1 })
      .limit(DASHBOARD_HONEY_TOKENS_LIMIT)
    const data = tokens.map((t: any) => ({
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

    return NextResponse.json({ success: true, data })
  } catch (err) {
    console.error('[api/admin/honeytokens] error', err)
    const msg = err instanceof Error ? err.message : String(err)
    return jsonError(`Failed to fetch honey tokens (${msg})`, 500)
  }
}

