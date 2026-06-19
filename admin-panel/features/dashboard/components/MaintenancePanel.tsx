'use client'

import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, Database, Loader2, RefreshCw, Trash2 } from 'lucide-react'
import { useSocket } from '@/features/dashboard/context/SocketContext'
import { clearDashboardCache } from '@/lib/dashboardCache'

interface MaintenanceStats {
  attackEvents: number
  attackerProfiles: number
  honeyTokens: number
  triggeredTokens: number
  bannedProfiles: number
}

type MaintenanceAction = 'events' | 'profiles' | 'honeytokens' | 'honeytokens_delete' | 'all'

const ACTIONS: {
  id: MaintenanceAction
  title: string
  description: string
  confirm: string
  destructive?: boolean
}[] = [
  {
    id: 'events',
    title: 'Clear attack history',
    description: 'Permanently delete all attack events from the telemetry database.',
    confirm: 'CLEAR EVENTS',
    destructive: true,
  },
  {
    id: 'profiles',
    title: 'Clear attacker profiles',
    description: 'Delete all attacker profiles, including geo data, risk scores, and IP bans.',
    confirm: 'CLEAR PROFILES',
    destructive: true,
  },
  {
    id: 'honeytokens',
    title: 'Reset honey tokens',
    description: 'Mark all honey tokens as unused and clear their trigger logs. Credentials stay in the DB.',
    confirm: 'RESET TOKENS',
  },
  {
    id: 'honeytokens_delete',
    title: 'Delete honey tokens',
    description: 'Remove all honey token records. New tokens are issued when the decoy keys page is visited.',
    confirm: 'DELETE TOKENS',
    destructive: true,
  },
  {
    id: 'all',
    title: 'Wipe all telemetry data',
    description: 'Delete attack events, attacker profiles, and honey tokens in one step.',
    confirm: 'WIPE ALL',
    destructive: true,
  },
]

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border bg-surface px-4 py-3">
      <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-foreground tabular-nums">{value.toLocaleString()}</div>
    </div>
  )
}

export default function MaintenancePanel() {
  const { refresh, clearScreen } = useSocket()
  const [stats, setStats] = useState<MaintenanceStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<MaintenanceAction | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [pending, setPending] = useState<(typeof ACTIONS)[number] | null>(null)
  const [confirmInput, setConfirmInput] = useState('')

  const loadStats = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/maintenance/', { credentials: 'include' })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error || 'Failed to load stats')
      setStats(json.data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load stats')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadStats()
  }, [loadStats])

  const runAction = async (action: (typeof ACTIONS)[number]) => {
    if (confirmInput.trim() !== action.confirm) {
      setError(`Type "${action.confirm}" to confirm.`)
      return
    }

    setBusy(action.id)
    setError(null)
    setSuccess(null)
    try {
      const res = await fetch('/api/admin/maintenance/', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: action.id, confirm: confirmInput.trim() }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error || 'Action failed')

      clearDashboardCache()
      clearScreen()
      await refresh({ force: true })

      setPending(null)
      setConfirmInput('')
      setSuccess(`${action.title} completed.`)
      await loadStats()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Action failed')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="flex flex-col gap-5 max-w-3xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Database className="w-4 h-4 text-primary" />
            Telemetry database maintenance
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Clean attack data from the admin panel instead of connecting to MongoDB directly.
            Safezone employee data is not affected.
          </p>
        </div>
        <button
          type="button"
          onClick={() => loadStats()}
          disabled={loading || busy !== null}
          className="p-2 rounded-lg border border-border hover:bg-surface-elevated transition-colors disabled:opacity-60"
          title="Refresh counts"
        >
          <RefreshCw className={`w-4 h-4 text-muted-foreground ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <StatCard label="Attack events" value={stats.attackEvents} />
          <StatCard label="Attacker profiles" value={stats.attackerProfiles} />
          <StatCard label="Honey tokens" value={stats.honeyTokens} />
          <StatCard label="Triggered tokens" value={stats.triggeredTokens} />
          <StatCard label="Banned IPs" value={stats.bannedProfiles} />
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-xs font-mono text-danger">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-lg border border-success/30 bg-success/10 px-3 py-2 text-xs font-mono text-success">
          {success}
        </div>
      )}

      <div className="flex flex-col gap-3">
        {ACTIONS.map(action => (
          <div
            key={action.id}
            className={`rounded-xl border px-4 py-3 ${
              action.destructive ? 'border-danger/25 bg-danger/5' : 'border-border bg-surface'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-medium text-foreground flex items-center gap-2">
                  {action.destructive && <AlertTriangle className="w-3.5 h-3.5 text-danger" />}
                  {action.title}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{action.description}</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setPending(action)
                  setConfirmInput('')
                  setError(null)
                  setSuccess(null)
                }}
                disabled={busy !== null}
                className={`shrink-0 text-xs font-mono px-3 py-1.5 rounded-md border transition-colors disabled:opacity-60 ${
                  action.destructive
                    ? 'border-danger/40 text-danger hover:bg-danger/15'
                    : 'border-border text-muted-foreground hover:text-foreground hover:bg-surface-elevated'
                }`}
              >
                {action.destructive ? 'Delete…' : 'Run…'}
              </button>
            </div>

            {pending?.id === action.id && (
              <div className="mt-3 pt-3 border-t border-border/60 space-y-2">
                <p className="text-[11px] font-mono text-muted-foreground">
                  Type <span className="text-foreground">{action.confirm}</span> to confirm:
                </p>
                <input
                  value={confirmInput}
                  onChange={e => setConfirmInput(e.target.value)}
                  placeholder={action.confirm}
                  className="w-full bg-background border border-border rounded-md px-3 py-2 text-xs font-mono"
                  autoFocus
                />
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => runAction(action)}
                    disabled={busy !== null || confirmInput.trim() !== action.confirm}
                    className="inline-flex items-center gap-1.5 text-xs font-mono px-3 py-1.5 rounded-md bg-danger/15 border border-danger/30 text-danger hover:bg-danger/25 transition-colors disabled:opacity-50"
                  >
                    {busy === action.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="w-3.5 h-3.5" />
                    )}
                    Confirm
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPending(null)
                      setConfirmInput('')
                    }}
                    disabled={busy !== null}
                    className="text-xs font-mono px-3 py-1.5 rounded-md border border-border text-muted-foreground hover:text-foreground"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
