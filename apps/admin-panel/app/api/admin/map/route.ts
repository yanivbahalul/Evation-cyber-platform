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
    const { AttackerProfile } = await getTelemetryModels()
    const profiles = await AttackerProfile.find({
      lat: { $exists: true, $ne: null },
      lng: { $exists: true, $ne: null },
    })
      .select('ip lat lng city riskScore lastSeen banned')
      .sort({ lastSeen: -1 })
      .limit(500)
      .lean()

    const data = profiles.map((p) => ({
      ip: String(p.ip ?? ''),
      lat: Number(p.lat ?? 0),
      lng: Number(p.lng ?? 0),
      city: p.city != null ? String(p.city) : '—',
      riskScore: Number(p.riskScore ?? 0),
      lastSeen: (p.lastSeen instanceof Date ? p.lastSeen : new Date(String(p.lastSeen ?? Date.now()))).toISOString(),
      banned: Boolean(p.banned),
    }))

    return NextResponse.json({ success: true, data })
  } catch (err) {
    console.error('[api/admin/map] error', err)
    const msg = err instanceof Error ? err.message : String(err)
    return jsonError(`Failed to fetch map data (${msg})`, 500)
  }
}
