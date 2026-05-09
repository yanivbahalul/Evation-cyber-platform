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
    const { AttackerProfile } = await getTelemetryModels()
    const profiles = await AttackerProfile.find().sort({ riskScore: -1 })
    const data = profiles.map((p: any) => ({
      ip: p.ip,
      city: p.city ?? '—',
      lat: p.lat ?? 0,
      lng: p.lng ?? 0,
      os: p.os ?? '—',
      platform: p.platform ?? undefined,
      browser: p.browser ?? '—',
      deviceType: p.deviceType ?? undefined,
      isBot: Boolean(p.isBot),
      riskScore: Number(p.riskScore ?? 0),
      firstSeen: (p.firstSeen instanceof Date ? p.firstSeen : new Date(p.firstSeen)).toISOString(),
      lastSeen: (p.lastSeen instanceof Date ? p.lastSeen : new Date(p.lastSeen)).toISOString(),
    }))

    return NextResponse.json({ success: true, data })
  } catch (err) {
    console.error('[api/admin/attackers] error', err)
    const msg = err instanceof Error ? err.message : String(err)
    return jsonError(`Failed to fetch attacker profiles (${msg})`, 500)
  }
}

