import { NextResponse, type NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/auth/requireAdmin'
import { fetchDashboardData } from '@/lib/server/fetchDashboardData'

export const runtime = 'nodejs'

function jsonError(message: string, status = 400) {
  return NextResponse.json({ success: false, error: message }, { status })
}

/** Single round-trip bootstrap for events + profiles + honey tokens. */
export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req)
  } catch {
    return jsonError('Unauthorized', 401)
  }

  try {
    const { searchParams } = new URL(req.url)
    const limit = Math.min(Number(searchParams.get('limit') ?? 200), 500)
    const data = await fetchDashboardData(limit)
    return NextResponse.json({ success: true, data })
  } catch (err) {
    console.error('[api/admin/dashboard] error', err)
    const msg = err instanceof Error ? err.message : String(err)
    return jsonError(`Failed to fetch dashboard (${msg})`, 500)
  }
}
