'use client'

import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Bell } from 'lucide-react'
import { useSocket } from '@/features/dashboard/context/SocketContext'
import type { ActiveTab } from './Sidebar'

const TAB_TITLES: Record<ActiveTab, string> = {
  map:      'Geographic Threat Map',
  events:   'Attack Event Log',
  profiles: 'Attacker Profiles',
  investigate: 'Attacker Investigation Workspace',
  tokens:   'Honey Token Status',
  adminUsers: 'Safe Zone Users',
  bans: 'IP Ban Management',
  maintenance: 'Telemetry Data Maintenance',
}

interface TopBarProps {
  active: ActiveTab
}

export default function TopBar({ active }: TopBarProps) {
  const {
    displayAlerts,
    demoMode,
    setDemoMode,
    isSyncing,
    hasDashboardData,
  } = useSocket()
  const [openNotifications, setOpenNotifications] = useState(false)
  const [portalReady, setPortalReady] = useState(false)

  const latest = useMemo(() => displayAlerts.slice(0, 8), [displayAlerts])
  const notificationCount = displayAlerts.length
  const [now, setNow] = useState('')

  useEffect(() => {
    setPortalReady(true)
    const format = () =>
      new Date().toLocaleString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      })
    setNow(format())
    const id = setInterval(format, 1000)
    return () => clearInterval(id)
  }, [])

  return (
    <header className="relative z-50 flex min-h-16 shrink-0 items-center justify-between gap-3 border-b border-border bg-background px-4 py-3 sm:px-6">
      <div>
        <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-primary">Blue Team / {active}</p>
        <h2 className="text-base font-semibold text-foreground">{TAB_TITLES[active]}</h2>
        <p className="hidden text-[10px] font-mono text-muted-foreground sm:block" suppressHydrationWarning>
          {now ? `${now} UTC` : '—'}
        </p>
      </div>

      <div className="relative flex items-center gap-2 sm:gap-3">
        {/* Live pulse */}
        <div
          className={`flex items-center gap-1.5 rounded border px-2 py-1 text-[10px] font-semibold tracking-wider ${
            demoMode
              ? 'border-accent/30 bg-accent/10 text-accent'
              : 'border-success/30 bg-success/10 text-success'
          }`}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full animate-pulse ${
              demoMode ? 'bg-accent' : 'bg-success'
            }`}
          />
          {demoMode ? 'DEMO' : isSyncing ? 'SYNC' : 'LIVE'}
        </div>

        {!demoMode && isSyncing && hasDashboardData && (
          <span className="text-[10px] font-mono text-muted-foreground px-2 py-1 rounded-md border border-border">
            Updating…
          </span>
        )}

        {/* Demo toggle */}
        <button
          onClick={() => setDemoMode(!demoMode)}
          className="hidden rounded border border-border bg-surface px-2.5 py-1 text-[10px] font-mono text-muted-foreground transition-colors hover:border-border-bright hover:text-foreground sm:block"
          aria-label="Toggle demo mode"
          title="Toggle demo mode (mock data vs real DB)"
        >
          Demo Mode: <span className={demoMode ? 'text-accent' : 'text-muted-foreground'}>{demoMode ? 'ON' : 'OFF'}</span>
        </button>

        {/* Alert bell */}
        <div className="relative">
          <button
            onClick={() => setOpenNotifications(v => !v)}
            className="relative p-2 rounded-lg hover:bg-surface-elevated transition-colors"
            aria-label="Notifications"
            title="Notifications"
          >
            <Bell className="w-4 h-4 text-muted-foreground" />
            {notificationCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-accent text-[9px] font-bold text-white flex items-center justify-center pulse-orange">
                {notificationCount > 9 ? '9+' : notificationCount}
              </span>
            )}
          </button>

          {portalReady && openNotifications && createPortal(
            <div className="fixed right-4 top-16 z-[2147483647] w-[calc(100vw-2rem)] max-w-80 overflow-hidden rounded-lg border border-border bg-surface shadow-2xl sm:right-6">
              <div className="px-3 py-2 border-b border-border flex items-center justify-between">
                <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                  Notifications
                </span>
                <button
                  onClick={() => setOpenNotifications(false)}
                  className="text-xs text-muted-foreground hover:text-foreground"
                  aria-label="Close notifications"
                >
                  ✕
                </button>
              </div>

              {latest.length === 0 ? (
                <div className="px-3 py-3 text-xs font-mono text-muted-foreground">
                  No notifications yet.
                </div>
              ) : (
                <div className="max-h-72 overflow-auto">
                  {latest.map(a => (
                    <div key={a.eventID} className="px-3 py-2 border-b border-border/50 last:border-b-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-accent/10 text-accent border border-accent/20 font-mono">
                          {a.trapType}
                        </span>
                        <span className="text-xs font-mono text-foreground">{a.attackerIp}</span>
                      </div>
                      <div className="mt-1 text-[11px] text-muted-foreground/80 font-mono truncate">
                        {a.city} · {new Date(a.timestamp).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
                        {'traceId' in a && a.traceId ? ` · trace ${a.traceId.slice(0, 8)}…` : ''}
                        {'path' in a && a.path ? ` · ${a.path}` : ''}
                      </div>
                      {'payload' in a && a.payload && (
                        <div className="mt-1 text-[11px] font-mono text-muted-foreground truncate">
                          payload: <span className="text-accent/80">{a.payload}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>,
            document.body
          )}
        </div>
      </div>
    </header>
  )
}
