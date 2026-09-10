'use client'

import {
  Activity,
  Ban,
  ChevronRight,
  Database,
  Key,
  LogOut,
  Map,
  Search,
  Shield,
  UserCog,
  Users,
} from 'lucide-react'
import { useSocket } from '@/features/dashboard/context/SocketContext'
import { useAuth } from '@/features/auth/context/AuthContext'

export type ActiveTab = 'map' | 'events' | 'profiles' | 'investigate' | 'tokens' | 'adminUsers' | 'bans' | 'maintenance'

interface SidebarProps {
  active: ActiveTab
  onSelect: (tab: ActiveTab) => void
}

const NAV_GROUPS: {
  label: string
  items: { id: ActiveTab; label: string; icon: React.ElementType; danger?: boolean }[]
}[] = [
  {
    label: 'Observe',
    items: [
      { id: 'map', label: 'Threat overview', icon: Map },
      { id: 'events', label: 'Event stream', icon: Activity },
    ],
  },
  {
    label: 'Investigate',
    items: [
      { id: 'profiles', label: 'Threat actors', icon: Users },
      { id: 'investigate', label: 'Case workspace', icon: Search },
      { id: 'tokens', label: 'Honey tokens', icon: Key },
    ],
  },
  {
    label: 'Administration',
    items: [
      { id: 'adminUsers', label: 'Safe Zone access', icon: UserCog },
      { id: 'maintenance', label: 'Data maintenance', icon: Database },
      { id: 'bans', label: 'Network blocks', icon: Ban, danger: true },
    ],
  },
]

export default function Sidebar({ active, onSelect }: SidebarProps) {
  const { connected, displayAlerts } = useSocket()
  const { logout } = useAuth()

  return (
    <aside className="soc-sidebar flex min-h-0 w-full shrink-0 flex-col border-b border-border bg-surface lg:min-h-screen lg:w-60 lg:border-b-0 lg:border-r">
      <div className="flex h-16 items-center gap-3 border-b border-border px-4 lg:px-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-md border border-primary/35 bg-primary/10">
          <Shield className="h-4 w-4 text-primary" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold tracking-[0.16em] text-foreground">EVATION</p>
          <p className="mt-0.5 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Blue Team Operations</p>
        </div>
      </div>

      <div className="soc-connection border-b border-border px-4 py-3">
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <span className={`h-1.5 w-1.5 rounded-full ${connected ? 'bg-success' : 'bg-muted-foreground'}`} />
          <span>{connected ? 'Telemetry connected' : 'Telemetry offline'}</span>
          {displayAlerts.length > 0 && (
            <span className="ml-auto rounded-sm bg-accent/15 px-1.5 py-0.5 font-mono text-[10px] text-accent">
              {displayAlerts.length} new
            </span>
          )}
        </div>
      </div>

      <nav className="soc-nav flex flex-1 gap-5 overflow-x-auto px-3 py-3 lg:flex-col lg:gap-5 lg:overflow-y-auto lg:py-5">
        {NAV_GROUPS.map(group => (
          <div key={group.label} className="soc-nav-group shrink-0">
            <p className="soc-nav-label mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/70">
              {group.label}
            </p>
            <div className="flex gap-1 lg:flex-col">
              {group.items.map(item => {
                const Icon = item.icon
                const isActive = active === item.id
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onSelect(item.id)}
                    className={`relative flex w-full items-center gap-2.5 whitespace-nowrap rounded-md px-2.5 py-2 text-left text-[13px] transition-colors ${
                      isActive
                        ? 'bg-surface-elevated font-medium text-foreground before:absolute before:inset-y-1.5 before:left-0 before:w-0.5 before:rounded-full before:bg-primary'
                        : item.danger
                          ? 'text-muted-foreground hover:bg-danger/10 hover:text-danger'
                          : 'text-muted-foreground hover:bg-surface-elevated hover:text-foreground'
                    }`}
                    aria-current={isActive ? 'page' : undefined}
                  >
                    <Icon className={`h-4 w-4 shrink-0 ${isActive ? 'text-primary' : ''}`} />
                    {item.label}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="soc-sidebar-footer border-t border-border p-4">
        <a
          href="/gateway/workspace/"
          className="mb-3 flex items-center justify-between rounded-md border border-border bg-background px-3 py-2.5 text-xs text-foreground transition-colors hover:border-primary/40"
        >
          <span>
            <span className="block font-medium">Safe Zone</span>
            <span className="mt-0.5 block text-[10px] text-muted-foreground">Recruitment & people</span>
          </span>
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
        </a>
        <button
          type="button"
          onClick={logout}
          className="flex items-center gap-2 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          <LogOut className="h-3.5 w-3.5" />
          Sign out
        </button>
      </div>
    </aside>
  )
}
