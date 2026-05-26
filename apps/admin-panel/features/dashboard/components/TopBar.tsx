'use client'

import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Bell, RefreshCw } from 'lucide-react'
import { useSocket } from '@/features/dashboard/context/SocketContext'
import type { ActiveTab } from './Sidebar'

const TAB_TITLES: Record<ActiveTab, string> = {
  map:      'Geographic Threat Map',
  events:   'Attack Event Log',
  profiles: 'Attacker Profiles',
  investigate: 'Attacker Investigation Workspace',
  tokens:   'Honey Token Status',
  adminUsers: 'Safe Zone Users',
}

interface TopBarProps {
  active: ActiveTab
}

export default function TopBar({ active }: TopBarProps) {
  const { liveAlerts, demoMode, setDemoMode, clearAlerts, refresh, isSyncing, hasDashboardData } =
    useSocket()
  const [openNotifications, setOpenNotifications] = useState(false)
  const [portalReady, setPortalReady] = useState(false)

  const latest = useMemo(() => liveAlerts.slice(0, 8), [liveAlerts])
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
    <header className="relative z-50 flex items-center justify-between px-6 py-3.5 bg-surface border-b border-border shrink-0">
      <div>
        <h2 className="text-base font-semibold text-foreground">{TAB_TITLES[active]}</h2>
        <p className="text-xs font-mono text-muted-foreground mt-0.5" suppressHydrationWarning>
          {now ? `${now} UTC` : '—'}
        </p>
      </div>

      <div className="flex items-center gap-3 relative">
        {/* Live pulse */}
        <div
          className={`flex items-center gap-1.5 text-xs font-mono px-2.5 py-1 rounded-md ${
            demoMode
              ? 'text-accent bg-accent/10 border border-accent/25'
              : 'text-success bg-success/10 border border-success/25'
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
          className="text-xs font-mono px-2.5 py-1 rounded-md bg-surface border border-border text-muted-foreground hover:text-foreground hover:border-border-bright transition-colors"
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
            {liveAlerts.length > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-accent text-[9px] font-bold text-white flex items-center justify-center pulse-orange">
                {liveAlerts.length > 9 ? '9+' : liveAlerts.length}
              </span>
            )}
          </button>

          {portalReady && openNotifications && createPortal(
            <div className="fixed right-6 top-16 w-80 bg-surface border border-border rounded-xl shadow-2xl overflow-hidden z-[2147483647]">
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
                        {a.traceId ? ` · trace ${a.traceId.slice(0, 8)}…` : ''}
                        {a.path ? ` · ${a.path}` : ''}
                      </div>
                      {a.payload && (
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

        {/* Refresh */}
        <button
          onClick={() => {
            // "Refresh threats": clear current notifications and (in real mode)
            // re-fetch latest telemetry from the server.
            clearAlerts()
            refresh().catch(() => {})
          }}
          className="p-2 rounded-lg hover:bg-surface-elevated transition-colors"
          aria-label="Refresh threats"
          title="Refresh threats"
        >
          <RefreshCw className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>
    </header>
  )
}
