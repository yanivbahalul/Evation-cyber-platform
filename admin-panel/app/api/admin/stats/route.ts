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
    const { AttackEvent, AttackerProfile, HoneyToken } = await getTelemetryModels()
    const [totalEvents, uniqueAttackers, triggeredTokens] = await Promise.all([
      AttackEvent.countDocuments(),
      AttackerProfile.countDocuments(),
      HoneyToken.countDocuments({ isTriggered: true }),
    ])

    const wastedTimeAgg = await AttackEvent.aggregate([
      { $group: { _id: null, totalWasted: { $sum: '$wasted_time_ms' } } },
    ])
    const totalWastedMs = wastedTimeAgg[0]?.totalWasted || 0

    return NextResponse.json({
      success: true,
      data: {
        totalEvents,
        uniqueAttackers,
        triggeredTokens,
        totalWastedMs,
      },
    })
  } catch (err) {
    console.error('[api/admin/stats] error', err)
    const msg = err instanceof Error ? err.message : String(err)
    return jsonError(`Failed to fetch stats (${msg})`, 500)
  }
}

