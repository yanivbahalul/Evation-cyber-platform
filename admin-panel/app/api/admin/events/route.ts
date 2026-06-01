import { NextResponse, type NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/auth/requireAdmin'
import { getTelemetryModels } from '@/lib/server/telemetryDb'
import { mapAttackEventDoc } from '@/lib/server/mapAttackEvent'

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
    const { searchParams } = new URL(req.url)
    const limit = Math.min(Number(searchParams.get('limit') ?? 200), 500)
    const trapType = searchParams.get('trapType') || undefined
    const ip = searchParams.get('ip') || undefined
    const traceId = searchParams.get('traceId') || undefined

    const { AttackEvent } = await getTelemetryModels()
    const filter: Record<string, unknown> = {}
    if (trapType) filter.trapType = trapType
    if (ip) filter.attackerIp = ip
    if (traceId) filter.traceId = traceId

    const events = await AttackEvent.find(filter).sort({ timestamp: -1 }).limit(limit).lean()
    const data = events.map((e: Record<string, unknown>) => mapAttackEventDoc(e))

    return NextResponse.json({ success: true, data })
  } catch (err) {
    console.error('[api/admin/events] error', err)
    const msg = err instanceof Error ? err.message : String(err)
    return jsonError(`Failed to fetch events (${msg})`, 500)
  }
}
