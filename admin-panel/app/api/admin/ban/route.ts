import { NextResponse, type NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/auth/requireAdmin'
import { getTelemetryModels } from '@/lib/server/telemetryDb'
import { resolvePortalUsername } from '@/lib/auth/portalAccess'

export const runtime = 'nodejs'

function jsonError(message: string, status = 400) {
  return NextResponse.json({ success: false, error: message }, { status })
}

function normalizeIp(raw: unknown): string | null {
  const ip = String(raw ?? '').trim()
  if (!ip || ip.length > 64) return null
  return ip
}

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req)
  } catch {
    return jsonError('Unauthorized', 401)
  }

  try {
    const { AttackerProfile } = await getTelemetryModels()
    const profiles = await AttackerProfile.find({ banned: true })
      .select('ip bannedAt bannedBy riskScore city')
      .sort({ bannedAt: -1 })
      .lean()

    return NextResponse.json({
      success: true,
      data: profiles.map((p) => ({
        ip: String(p.ip),
        bannedAt: p.bannedAt ? new Date(p.bannedAt).toISOString() : null,
        bannedBy: p.bannedBy != null ? String(p.bannedBy) : null,
        riskScore: Number(p.riskScore ?? 0),
        city: p.city != null ? String(p.city) : '—',
      })),
    })
  } catch (err) {
    console.error('[api/admin/ban] GET error', err)
    const msg = err instanceof Error ? err.message : String(err)
    return jsonError(`Failed to list bans (${msg})`, 500)
  }
}

export async function POST(req: NextRequest) {
  let adminUsername: string | null = null
  try {
    await requireAdmin(req)
    adminUsername = await resolvePortalUsername(req)
  } catch {
    return jsonError('Unauthorized', 401)
  }

  let body: { ip?: string }
  try {
    body = await req.json()
  } catch {
    return jsonError('Invalid JSON body')
  }

  const ip = normalizeIp(body.ip)
  if (!ip) return jsonError('Missing or invalid ip')

  try {
    const { AttackerProfile } = await getTelemetryModels()
    const profile = await AttackerProfile.findOneAndUpdate(
      { ip },
      {
        $set: {
          banned: true,
          bannedAt: new Date(),
          bannedBy: adminUsername || 'admin',
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    ).lean()

    return NextResponse.json({
      success: true,
      data: { ip: String(profile.ip), banned: true },
    })
  } catch (err) {
    console.error('[api/admin/ban] POST error', err)
    const msg = err instanceof Error ? err.message : String(err)
    return jsonError(`Failed to ban IP (${msg})`, 500)
  }
}

export async function DELETE(req: NextRequest) {
  try {
    await requireAdmin(req)
  } catch {
    return jsonError('Unauthorized', 401)
  }

  const ip = normalizeIp(req.nextUrl.searchParams.get('ip'))
  if (!ip) return jsonError('Missing or invalid ip query param')

  try {
    const { AttackerProfile } = await getTelemetryModels()
    await AttackerProfile.findOneAndUpdate(
      { ip },
      { $set: { banned: false }, $unset: { bannedAt: 1, bannedBy: 1 } }
    )

    return NextResponse.json({ success: true, data: { ip, banned: false } })
  } catch (err) {
    console.error('[api/admin/ban] DELETE error', err)
    const msg = err instanceof Error ? err.message : String(err)
    return jsonError(`Failed to unban IP (${msg})`, 500)
  }
}
