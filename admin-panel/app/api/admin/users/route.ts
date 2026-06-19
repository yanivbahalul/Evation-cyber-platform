import { NextResponse, type NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/auth/requireAdmin'
import { getSafezoneModels } from '@/lib/server/safezoneDb'

export const runtime = 'nodejs'

function jsonError(message: string, status = 400) {
  return NextResponse.json({ success: false, error: message }, { status })
}

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req)
    const { User } = await getSafezoneModels()
    const users = await User.find({}, { username: 1, role: 1, isActive: 1, createdAt: 1, updatedAt: 1 })
      .sort({ createdAt: -1 })
      .lean()
    return NextResponse.json({ success: true, data: users })
  } catch (e: any) {
    if (e?.message === 'missing_auth') return jsonError('Unauthorized', 401)
    if (String(e?.message).includes('forbidden')) return jsonError('Forbidden', 403)
    return jsonError('Failed to list users', 500)
  }
}

export async function PATCH(req: NextRequest) {
  try {
    await requireAdmin(req)
    const body = (await req.json().catch(() => null)) as
      | { username?: string; role?: 'admin' | 'user'; isActive?: boolean }
      | null
    if (!body) return jsonError('Invalid JSON body')

    const username = (body.username ?? '').trim()
    if (!username) return jsonError('Missing username')

    const updates: Record<string, unknown> = {}
    if (body.role) {
      if (body.role !== 'admin' && body.role !== 'user') return jsonError('Invalid role')
      updates.role = body.role
    }
    if (typeof body.isActive === 'boolean') updates.isActive = body.isActive
    if (!Object.keys(updates).length) return jsonError('No updates provided')

    const { User } = await getSafezoneModels()
    const updated = await User.findOneAndUpdate({ username }, { $set: updates }, { new: true }).lean()
    if (!updated) return jsonError('User not found', 404)

    return NextResponse.json({ success: true })
  } catch (e: any) {
    if (e?.message === 'missing_auth') return jsonError('Unauthorized', 401)
    if (String(e?.message).includes('forbidden')) return jsonError('Forbidden', 403)
    return jsonError('Failed to update user', 500)
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const auth = await requireAdmin(req)
    const body = (await req.json().catch(() => null)) as { username?: string } | null
    if (!body) return jsonError('Invalid JSON body')

    const username = (body.username ?? '').trim()
    if (!username) return jsonError('Missing username')
    if (auth.sub === username) return jsonError('Cannot delete your own account', 403)

    const { User } = await getSafezoneModels()
    const target = await User.findOne({ username }).lean()
    if (!target) return jsonError('User not found', 404)

    if ((target as { role?: string }).role === 'admin') {
      const adminCount = await User.countDocuments({ role: 'admin' })
      if (adminCount <= 1) return jsonError('Cannot delete the last admin account', 403)
    }

    await User.deleteOne({ username })
    return NextResponse.json({ success: true })
  } catch (e: any) {
    if (e?.message === 'missing_auth') return jsonError('Unauthorized', 401)
    if (String(e?.message).includes('forbidden')) return jsonError('Forbidden', 403)
    return jsonError('Failed to delete user', 500)
  }
}

