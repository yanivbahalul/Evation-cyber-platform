import { NextResponse, type NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/auth/requireAdmin'
import { getTelemetryModels } from '@/lib/server/telemetryDb'
import { mapAttackEventDoc, mapAttackerProfileDoc } from '@/lib/server/mapAttackEvent'

export const runtime = 'nodejs'

function jsonError(message: string, status = 400) {
  return NextResponse.json({ success: false, error: message }, { status })
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ ip: string }> },
) {
  try {
    await requireAdmin(req)
  } catch {
    return jsonError('Unauthorized', 401)
  }

  try {
    const { ip: rawIp } = await params
    const ip = decodeURIComponent(rawIp)
    const { searchParams } = new URL(req.url)
    const traceId = searchParams.get('traceId') || undefined
    const limit = Math.min(Number(searchParams.get('limit') ?? 200), 500)

    const { AttackEvent, AttackerProfile } = await getTelemetryModels()
    const eventFilter: Record<string, unknown> = { attackerIp: ip }
    if (traceId) eventFilter.traceId = traceId

    const [profileDoc, events] = await Promise.all([
      AttackerProfile.findOne({ ip }).lean(),
      AttackEvent.find(eventFilter).sort({ timestamp: 1 }).limit(limit).lean(),
    ])

    return NextResponse.json({
      success: true,
      data: {
        profile: profileDoc ? mapAttackerProfileDoc(profileDoc as Record<string, unknown>) : null,
        events: events.map((e: Record<string, unknown>) => mapAttackEventDoc(e)),
      },
    })
  } catch (err) {
    console.error('[api/admin/attackers/timeline] error', err)
    const msg = err instanceof Error ? err.message : String(err)
    return jsonError(`Failed to fetch timeline (${msg})`, 500)
  }
}
