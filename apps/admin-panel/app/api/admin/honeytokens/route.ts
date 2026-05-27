import { NextResponse, type NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/auth/requireAdmin'
import { getTelemetryModels } from '@/lib/server/telemetryDb'

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
    const data = tokens.map((t: any) => ({
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

    return NextResponse.json({ success: true, data })
  } catch (err) {
    console.error('[api/admin/honeytokens] error', err)
    const msg = err instanceof Error ? err.message : String(err)
    return jsonError(`Failed to fetch honey tokens (${msg})`, 500)
  }
}

