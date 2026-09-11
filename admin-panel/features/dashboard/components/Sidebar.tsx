'use client'

import {
  Activity,
  CircleCheck,
  Database,
  Globe2,
  KeyRound,
  LayoutDashboard,
  LogOut,
  ScanSearch,
  ShieldBan,
  UserRoundSearch,
  UsersRound,
} from 'lucide-react'
import { useSocket } from '@/features/dashboard/context/SocketContext'
import { useAuth } from '@/features/auth/context/AuthContext'

export type ActiveTab =
  | 'overview'
  | 'map'
  | 'events'
  | 'profiles'
  | 'investigate'
  | 'tokens'
  | 'adminUsers'
  | 'bans'
  | 'maintenance'

interface SidebarProps {
  active: ActiveTab
  onSelect: (tab: ActiveTab) => void
}

const NAV_GROUPS: Array<{
  label: string
  items: Array<{ id: ActiveTab; label: string; icon: React.ElementType; danger?: boolean }>
}> = [
  {
    label: 'HoneyShield',
    items: [
      { id: 'overview', label: 'Overview', icon: LayoutDashboard },
      { id: 'map', label: 'Threat Map', icon: Globe2 },
      { id: 'events', label: 'Attack Events', icon: Activity },
      { id: 'profiles', label: 'Attackers', icon: UserRoundSearch },
      { id: 'investigate', label: 'Investigation', icon: ScanSearch },
    ],
  },
  { label: 'Deception', items: [{ id: 'tokens', label: 'Honey Tokens', icon: KeyRound }] },
  {
    label: 'Management',
    items: [
      { id: 'adminUsers', label: 'Safe Zone Users', icon: UsersRound },
      { id: 'bans', label: 'Blocked IPs', icon: ShieldBan, danger: true },
    ],
  },
  { label: 'System', items: [{ id: 'maintenance', label: 'Data Maintenance', icon: Database }] },
]

/** Renders dashboard navigation and connection status. */
// skipcq: JS-0067 -- React component export in an ES module.
export default function Sidebar({ active, onSelect }: SidebarProps) {
  const { connected, displayAlerts } = useSocket()
  const { logout } = useAuth()

  return (
    <aside className="soc-sidebar flex min-h-0 w-full shrink-0 flex-col border-b border-border bg-surface lg:min-h-screen lg:w-64 lg:border-b-0 lg:border-r">
      <div className="flex h-[72px] items-center gap-3 border-b border-border px-4 lg:px-5">
        <img src="/honeyshield-shield.png" alt="" className="h-10 w-10 shrink-0 object-contain" />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">HoneyShield</p>
          <p className="mt-0.5 text-[10px] text-muted-foreground">Cyber Deception Platform</p>
        </div>
      </div>

      <div className="soc-connection border-b border-border px-4 py-3">
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <span className={`h-1.5 w-1.5 rounded-full ${connected ? 'bg-success' : 'bg-muted-foreground'}`} />
          <span>{connected ? 'Live connection' : 'Connection offline'}</span>
          {displayAlerts.length > 0 && (
            <span className="ml-auto rounded bg-primary/10 px-1.5 py-0.5 font-mono text-[10px] text-primary">
              {displayAlerts.length} new
            </span>
          )}
        </div>
      </div>

      <nav className="soc-nav flex flex-1 gap-5 overflow-x-auto px-3 py-3 lg:flex-col lg:overflow-y-auto lg:py-5">
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
                    className={`flex w-full items-center gap-2.5 whitespace-nowrap rounded-lg px-2.5 py-2 text-left text-[13px] transition-colors ${
                      isActive
                        ? 'bg-primary/10 font-medium text-primary'
                        : item.danger
                          ? 'text-muted-foreground hover:bg-danger/5 hover:text-danger'
                          : 'text-muted-foreground hover:bg-surface-elevated hover:text-foreground'
                    }`}
                    aria-current={isActive ? 'page' : undefined}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    {item.label}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="soc-sidebar-footer border-t border-border p-4">
        <div className="mb-3 flex items-center gap-2 text-[11px] text-muted-foreground">
          <CircleCheck className="h-3.5 w-3.5 text-success" />
          Analyst services operational
        </div>
        <button
          type="button"
          onClick={logout}
          className="flex items-center gap-2 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          <LogOut className="h-3.5 w-3.5" />
          Sign Out
        </button>
      </div>
    </aside>
  )
}
