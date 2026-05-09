import { NextResponse, type NextRequest } from 'next/server'
import { requireAuth } from '@/lib/auth/requireAuth'
import { getTelemetryModels } from '@/lib/server/telemetryDb'

export const runtime = 'nodejs'

function jsonError(message: string, status = 400) {
  return NextResponse.json({ success: false, error: message }, { status })
}

export async function GET(req: NextRequest) {
  try {
    await requireAuth(req)
  } catch {
    return jsonError('Unauthorized', 401)
  }

  try {
    const { searchParams } = new URL(req.url)
    const limit = Math.min(Number(searchParams.get('limit') ?? 200), 500)
    const trapType = searchParams.get('trapType') || undefined
    const ip = searchParams.get('ip') || undefined

    const { AttackEvent } = await getTelemetryModels()
    const filter: Record<string, unknown> = {}
    if (trapType) filter.trapType = trapType
    if (ip) filter.attackerIp = ip

    const events = await AttackEvent.find(filter).sort({ timestamp: -1 }).limit(limit)
    const data = events.map((e: any) => ({
      eventID: e.eventID,
      attackerIp: e.attackerIp,
      trapType: e.trapType,
      payload: e.payload ?? undefined,
      wasted_time_ms: e.wasted_time_ms ?? 0,
      bytes_sent: e.bytes_sent ?? 0,
      timestamp: (e.timestamp instanceof Date ? e.timestamp : new Date(e.timestamp)).toISOString(),
    }))

    return NextResponse.json({ success: true, data })
  } catch (err) {
    console.error('[api/admin/events] error', err)
    const msg = err instanceof Error ? err.message : String(err)
    return jsonError(`Failed to fetch events (${msg})`, 500)
  }
}

