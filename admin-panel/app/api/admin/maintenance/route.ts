import { NextResponse, type NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/auth/requireAdmin'
import { getTelemetryModels } from '@/lib/server/telemetryDb'

export const runtime = 'nodejs'

const ACTIONS = {
  events: {
    confirm: 'CLEAR EVENTS',
    run: async (models: Awaited<ReturnType<typeof getTelemetryModels>>) => {
      const { deletedCount } = await models.AttackEvent.deleteMany({})
      return { attackEvents: deletedCount ?? 0 }
    },
  },
  profiles: {
    confirm: 'CLEAR PROFILES',
    run: async (models: Awaited<ReturnType<typeof getTelemetryModels>>) => {
      const { deletedCount } = await models.AttackerProfile.deleteMany({})
      return { attackerProfiles: deletedCount ?? 0 }
    },
  },
  honeytokens: {
    confirm: 'RESET TOKENS',
    run: async (models: Awaited<ReturnType<typeof getTelemetryModels>>) => {
      const { modifiedCount } = await models.HoneyToken.updateMany(
        {},
        { $set: { isTriggered: false, triggeredLogs: [] } },
      )
      return { honeyTokensReset: modifiedCount ?? 0 }
    },
  },
  honeytokens_delete: {
    confirm: 'DELETE TOKENS',
    run: async (models: Awaited<ReturnType<typeof getTelemetryModels>>) => {
      const { deletedCount } = await models.HoneyToken.deleteMany({})
      return { honeyTokens: deletedCount ?? 0 }
    },
  },
  all: {
    confirm: 'WIPE ALL',
    run: async (models: Awaited<ReturnType<typeof getTelemetryModels>>) => {
      const [events, profiles, tokens] = await Promise.all([
        models.AttackEvent.deleteMany({}),
        models.AttackerProfile.deleteMany({}),
        models.HoneyToken.deleteMany({}),
      ])
      return {
        attackEvents: events.deletedCount ?? 0,
        attackerProfiles: profiles.deletedCount ?? 0,
        honeyTokens: tokens.deletedCount ?? 0,
      }
    },
  },
} as const

type MaintenanceAction = keyof typeof ACTIONS

function jsonError(message: string, status = 400) {
  return NextResponse.json({ success: false, error: message }, { status })
}

function isAction(value: unknown): value is MaintenanceAction {
  return typeof value === 'string' && value in ACTIONS
}

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req)
  } catch {
    return jsonError('Unauthorized', 401)
  }

  try {
    const { AttackEvent, AttackerProfile, HoneyToken } = await getTelemetryModels()
    const [attackEvents, attackerProfiles, honeyTokens, triggeredTokens, bannedProfiles] =
      await Promise.all([
        AttackEvent.countDocuments(),
        AttackerProfile.countDocuments(),
        HoneyToken.countDocuments(),
        HoneyToken.countDocuments({ isTriggered: true }),
        AttackerProfile.countDocuments({ banned: true }),
      ])

    return NextResponse.json({
      success: true,
      data: {
        attackEvents,
        attackerProfiles,
        honeyTokens,
        triggeredTokens,
        bannedProfiles,
      },
    })
  } catch (err) {
    console.error('[api/admin/maintenance] GET error', err)
    const msg = err instanceof Error ? err.message : String(err)
    return jsonError(`Failed to load maintenance stats (${msg})`, 500)
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAdmin(req)
  } catch {
    return jsonError('Unauthorized', 401)
  }

  let body: { action?: string; confirm?: string }
  try {
    body = await req.json()
  } catch {
    return jsonError('Invalid JSON body')
  }

  if (!isAction(body.action)) {
    return jsonError('Invalid action. Use: events, profiles, honeytokens, honeytokens_delete, all')
  }

  const spec = ACTIONS[body.action]
  const confirm = String(body.confirm ?? '').trim()
  if (confirm !== spec.confirm) {
    return jsonError(`Confirmation required. Type "${spec.confirm}" to proceed.`)
  }

  try {
    const models = await getTelemetryModels()
    const deleted = await spec.run(models)
    console.info('[api/admin/maintenance] action completed', { action: body.action, deleted })

    return NextResponse.json({
      success: true,
      data: { action: body.action, deleted },
    })
  } catch (err) {
    console.error('[api/admin/maintenance] POST error', err)
    const msg = err instanceof Error ? err.message : String(err)
    return jsonError(`Maintenance action failed (${msg})`, 500)
  }
}
