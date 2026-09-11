'use client'

import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Bell, Moon, Sun } from 'lucide-react'
import { useSocket } from '@/features/dashboard/context/SocketContext'
import type { ActiveTab } from './Sidebar'

const TAB_TITLES: Record<ActiveTab, string> = {
  overview: 'Security Overview',
  map:      'Threat Map',
  events:   'Attack Events',
  profiles: 'Attackers',
  investigate: 'Investigation',
  tokens:   'Honey Tokens',
  adminUsers: 'Safe Zone Users',
  bans: 'Blocked IPs',
  maintenance: 'Data Maintenance',
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
  const [darkMode, setDarkMode] = useState(false)

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
        timeZone: 'UTC',
      })
    setNow(format())
    const id = setInterval(format, 1000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    const savedTheme = window.localStorage.getItem('honeyshield-theme')
    const useDark = savedTheme ? savedTheme === 'dark' : true
    document.documentElement.classList.toggle('dark', useDark)
    document.documentElement.style.colorScheme = useDark ? 'dark' : 'light'
    setDarkMode(useDark)
  }, [])

  const toggleTheme = () => {
    const nextDark = !darkMode
    const applyTheme = () => {
      document.documentElement.classList.toggle('dark', nextDark)
      document.documentElement.style.colorScheme = nextDark ? 'dark' : 'light'
      window.localStorage.setItem('honeyshield-theme', nextDark ? 'dark' : 'light')
      setDarkMode(nextDark)
    }
    const transitionDocument = document as Document & { startViewTransition?: (callback: () => void) => void }
    if (transitionDocument.startViewTransition) transitionDocument.startViewTransition(applyTheme)
    else applyTheme()
  }

  return (
    <header className="relative z-50 flex min-h-[72px] shrink-0 items-center justify-between gap-3 border-b border-border bg-surface px-4 py-3 sm:px-6">
      <div>
        <h2 className="text-base font-semibold text-foreground">{TAB_TITLES[active]}</h2>
        <p className="mt-1 hidden text-[10px] font-mono text-muted-foreground sm:block" suppressHydrationWarning>
          {now ? `${now} UTC` : '—'}
        </p>
      </div>

      <div className="relative flex items-center gap-2 sm:gap-3">
        <button
          onClick={toggleTheme}
          className="flex h-9 items-center gap-2 rounded-lg border border-primary/30 bg-primary/10 px-3 text-[10px] font-mono font-bold tracking-wider text-primary shadow-sm transition-colors hover:border-primary/60 hover:bg-primary/15"
          aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
          title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {darkMode ? <Sun className="h-3.5 w-3.5 text-warning" /> : <Moon className="h-3.5 w-3.5 text-primary" />}
          <span>THEME · {darkMode ? 'DARK' : 'LIGHT'}</span>
        </button>

        {/* Live pulse */}
        <div
          className={`flex items-center gap-1.5 rounded border px-2 py-1 text-[10px] font-semibold tracking-wider ${
            demoMode
              ? 'border-warning/30 bg-warning/10 text-warning'
              : 'border-success/30 bg-success/10 text-success'
          }`}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full animate-pulse ${
              demoMode ? 'bg-warning' : 'bg-success'
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
          Demo Mode: <span className={demoMode ? 'text-warning' : 'text-muted-foreground'}>{demoMode ? 'ON' : 'OFF'}</span>
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
              <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-danger text-[9px] font-bold text-white">
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
                        <span className="rounded border border-border bg-surface-elevated px-2 py-0.5 font-mono text-[10px] font-bold text-muted-foreground">
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
                          payload: <span className="text-foreground">{a.payload}</span>
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
