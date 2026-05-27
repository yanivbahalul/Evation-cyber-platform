'use client'

import { useRouter } from 'next/navigation'
import { Shield, Map, Activity, Users, Key, Ban, Wifi, WifiOff, LogOut, UserCog, Search } from 'lucide-react'
import { useSocket } from '@/features/dashboard/context/SocketContext'
import { useAuth } from '@/features/auth/context/AuthContext'

export type ActiveTab = 'map' | 'events' | 'profiles' | 'investigate' | 'tokens' | 'adminUsers' | 'bans'

interface SidebarProps {
  active: ActiveTab
  onSelect: (tab: ActiveTab) => void
}

const NAV_ITEMS: { id: ActiveTab; label: string; icon: React.ElementType }[] = [
  { id: 'map',      label: 'Threat Map',       icon: Map      },
  { id: 'events',   label: 'Attack Events',    icon: Activity },
  { id: 'profiles', label: 'Attacker Profiles',icon: Users    },
  { id: 'investigate', label: 'Investigate',   icon: Search   },
  { id: 'tokens',   label: 'Honey Tokens',     icon: Key      },
  { id: 'adminUsers', label: 'Safe Zone users', icon: UserCog },
]

export default function Sidebar({ active, onSelect }: SidebarProps) {
  const router = useRouter()
  const { connected, liveAlerts } = useSocket()
  const { logout } = useAuth()

  return (
    <aside className="flex flex-col w-56 min-h-screen bg-surface border-r border-border shrink-0">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-border">
        <div className="w-8 h-8 rounded-lg bg-primary/15 border border-primary/30 flex items-center justify-center">
          <Shield className="w-4 h-4 text-primary" />
        </div>
        <div>
          <p className="text-sm font-bold text-foreground leading-none">HoneyNet</p>
          <p className="text-[10px] text-muted-foreground font-mono mt-0.5">Blue Team SOC</p>
        </div>
      </div>

      {/* Connection badge */}
      <div className="px-4 py-3 border-b border-border">
        <div className={`flex items-center gap-2 text-xs font-mono px-2 py-1.5 rounded-md ${
          connected
            ? 'bg-success/10 border border-success/30 text-success'
            : 'bg-muted border border-border text-muted-foreground'
        }`}>
          {connected
            ? <><Wifi className="w-3 h-3" /> Socket live</>
            : <><WifiOff className="w-3 h-3" /> Socket offline</>
          }
          {connected && liveAlerts.length > 0 && (
            <span className="ml-auto bg-accent text-accent-foreground text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center pulse-orange">
              {Math.min(liveAlerts.length, 9)}
            </span>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 flex flex-col gap-1">
        <p className="text-[10px] font-mono text-muted-foreground/60 uppercase tracking-widest px-2 mb-2">
          Monitoring
        </p>
        {NAV_ITEMS.map(item => {
          const Icon = item.icon
          const isActive = active === item.id
          return (
            <button
              key={item.id}
              onClick={() => onSelect(item.id)}
              className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 text-left ${
                isActive
                  ? 'bg-primary/15 text-primary border border-primary/25'
                  : 'text-muted-foreground hover:text-foreground hover:bg-surface-elevated'
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {item.label}
            </button>
          )
        })}

        <div className="mt-4 pt-4 border-t border-border">
          <p className="text-[10px] font-mono text-muted-foreground/60 uppercase tracking-widest px-2 mb-2">
            Actions
          </p>
          <button
            type="button"
            onClick={() => {
              onSelect('bans')
              router.push('/admin/ban')
            }}
            className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
              active === 'bans'
                ? 'bg-danger/15 text-danger border border-danger/30'
                : 'text-muted-foreground hover:text-danger hover:bg-danger/10'
            }`}
          >
            <Ban className="w-4 h-4 shrink-0" />
            Manage Bans
          </button>
        </div>
      </nav>

      {/* Footer */}
      <div className="px-4 py-4 border-t border-border space-y-3">
        <a
          href="/gateway/workspace/"
          className="flex items-center gap-2 text-xs text-muted-foreground hover:text-primary transition-colors font-mono"
        >
          Employee workspace
        </a>
        <button
          onClick={logout}
          className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors font-mono"
        >
          <LogOut className="w-3.5 h-3.5" />
          Sign Out
        </button>
        <p className="text-[10px] text-muted-foreground/40 font-mono mt-2">
          HIT InnoTech v2.4.0
        </p>
      </div>
    </aside>
  )
}
