import { NextResponse, type NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/auth/requireAdmin'
import { getTelemetryModels } from '@/lib/server/telemetryDb'
import { mapAttackerProfileDoc } from '@/lib/server/mapAttackEvent'
import { DASHBOARD_PROFILES_LIMIT } from '@/lib/server/fetchDashboardData'

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
    const { AttackerProfile } = await getTelemetryModels()
    const profiles = await AttackerProfile.find()
      .sort({ riskScore: -1 })
      .limit(DASHBOARD_PROFILES_LIMIT)
      .lean()
    const data = profiles.map((p: Record<string, unknown>) => mapAttackerProfileDoc(p))

    return NextResponse.json({ success: true, data })
  } catch (err) {
    console.error('[api/admin/attackers] error', err)
    const msg = err instanceof Error ? err.message : String(err)
    return jsonError(`Failed to fetch attacker profiles (${msg})`, 500)
  }
}
