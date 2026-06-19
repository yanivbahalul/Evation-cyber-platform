import { NextResponse, type NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/auth/requireAdmin'
import { getSafezoneModels } from '@/lib/server/safezoneDb'
import type { HrTicket } from '@/lib/types/hrTicket'

export const runtime = 'nodejs'

function jsonError(message: string, status = 400) {
  return NextResponse.json({ success: false, error: message }, { status })
}

function mapTicket(doc: Record<string, unknown>): HrTicket {
  return {
    _id: String(doc._id),
    ticketId: String(doc.ticketId ?? ''),
    subject: String(doc.subject ?? ''),
    message: String(doc.message ?? ''),
    source: (doc.source as HrTicket['source']) ?? 'contact',
    status: (doc.status as HrTicket['status']) ?? 'open',
    isSuspicious: Boolean(doc.isSuspicious),
    suspiciousReasons: Array.isArray(doc.suspiciousReasons)
      ? doc.suspiciousReasons.map(String)
      : [],
    submittedBy: doc.submittedBy != null ? String(doc.submittedBy) : null,
    submitterIp: String(doc.submitterIp ?? ''),
    submitterUserAgent: String(doc.submitterUserAgent ?? ''),
    traceId: doc.traceId != null ? String(doc.traceId) : null,
    createdAt: doc.createdAt ? new Date(doc.createdAt as string | Date).toISOString() : '',
    updatedAt: doc.updatedAt ? new Date(doc.updatedAt as string | Date).toISOString() : '',
  }
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
    const suspiciousOnly = searchParams.get('suspicious') === '1'
    const status = searchParams.get('status') || undefined

    const filter: Record<string, unknown> = {}
    if (suspiciousOnly) filter.isSuspicious = true
    if (status && ['open', 'in_review', 'closed'].includes(status)) filter.status = status

    const { HrTicket } = await getSafezoneModels()
    const rows = await HrTicket.find(filter).sort({ createdAt: -1 }).limit(limit).lean()
    const data = rows.map((row: Record<string, unknown>) => mapTicket(row))

    return NextResponse.json({ success: true, data })
  } catch (err) {
    console.error('[api/admin/tickets] error', err)
    const msg = err instanceof Error ? err.message : String(err)
    return jsonError(`Failed to fetch tickets (${msg})`, 500)
  }
}

export async function PATCH(req: NextRequest) {
  try {
    await requireAdmin(req)
  } catch {
    return jsonError('Unauthorized', 401)
  }

  try {
    const body = await req.json()
    const ticketId = String(body?.ticketId || '').trim()
    const status = String(body?.status || '').trim()
    if (!ticketId) return jsonError('ticketId is required')
    if (!['open', 'in_review', 'closed'].includes(status)) {
      return jsonError('Invalid status')
    }

    const { HrTicket } = await getSafezoneModels()
    const updated = await HrTicket.findOneAndUpdate(
      { ticketId },
      { $set: { status } },
      { new: true }
    ).lean()

    if (!updated) return jsonError('Ticket not found', 404)
    return NextResponse.json({ success: true, data: mapTicket(updated as Record<string, unknown>) })
  } catch (err) {
    console.error('[api/admin/tickets] patch error', err)
    const msg = err instanceof Error ? err.message : String(err)
    return jsonError(`Failed to update ticket (${msg})`, 500)
  }
}
