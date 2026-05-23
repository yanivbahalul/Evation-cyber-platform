'use client'

import dynamic from 'next/dynamic'
import { useSocket, type LiveAlert } from '@/features/dashboard/context/SocketContext'
import { useInvestigation } from '@/features/investigation/context/InvestigationContext'
import { shortTrace } from '@/lib/attackIntel'
import { AlertTriangle, MapPin, Zap, Clock } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

const LeafletMap = dynamic(() => import('./LeafletMap'), { ssr: false })

const TRAP_COLORS: Record<string, string> = {
  SQL_INJECTION: '#ef4444',
  SQLI: '#ef4444',
  XSS: '#06b6d4',
  RECON: '#64748b',
  HONEY_TOKEN: '#f97316',
  DATA_BOMB: '#f59e0b',
  PATH_TRAVERSAL: '#8b5cf6',
  BRUTE_FORCE: '#ec4899',
  XSS_PROBE: '#06b6d4',
  SSRF: '#14b8a6',
  SCANNER: '#a855f7',
}

interface ThreatMapProps {
  onNavigateInvestigate?: () => void
}

export default function ThreatMap({ onNavigateInvestigate }: ThreatMapProps) {
  const { liveAlerts } = useSocket()
  const latest = liveAlerts.slice(0, 8)

  return (
    <div className="flex flex-col gap-4 h-full">
      <div className="flex-1 min-h-0 rounded-xl overflow-hidden border border-border" style={{ minHeight: 400 }}>
        <LeafletMap />
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-mono text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
            <Zap className="w-3 h-3 text-accent" />
            Live Alert Feed
          </h3>
          <span className="text-[10px] font-mono text-muted-foreground/60">{liveAlerts.length} events</span>
        </div>

        <div className="flex flex-col gap-1.5 max-h-52 overflow-y-auto">
          {latest.length === 0 ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono py-4 px-3 bg-surface rounded-lg border border-border">
              <AlertTriangle className="w-4 h-4 text-muted-foreground/50" />
              Waiting for incoming attack events...
            </div>
          ) : (
            latest.map(alert => (
              <AlertRow key={alert.eventID} alert={alert} onNavigateInvestigate={onNavigateInvestigate} />
            ))
          )}
        </div>
      </div>
    </div>
  )
}

function AlertRow({
  alert,
  onNavigateInvestigate,
}: {
  alert: LiveAlert
  onNavigateInvestigate?: () => void
}) {
  const { openInvestigation } = useInvestigation()
  const color = TRAP_COLORS[alert.trapType] ?? '#7a9bb5'
  const ago = formatDistanceToNow(new Date(alert.timestamp), { addSuffix: true })

  return (
    <button
      type="button"
      onClick={() => {
        openInvestigation({ ip: alert.attackerIp, traceId: alert.traceId })
        onNavigateInvestigate?.()
      }}
      className="flex flex-col gap-1 w-full text-left bg-surface border border-border rounded-lg px-3 py-2 text-xs font-mono hover:border-primary/40 hover:bg-primary/5 transition-colors"
      style={{ borderLeftColor: color, borderLeftWidth: 3 }}
    >
      <div className="flex items-center gap-3 w-full">
        <span className="shrink-0 font-bold" style={{ color }}>
          {alert.trapType.replace(/_/g, ' ')}
        </span>
        <span className="text-foreground">{alert.attackerIp}</span>
        <MapPin className="w-3 h-3 text-muted-foreground shrink-0" />
        <span className="text-muted-foreground truncate">{alert.city}</span>
        <span className="ml-auto text-muted-foreground/60 flex items-center gap-1 shrink-0">
          <Clock className="w-3 h-3" />
          {ago}
        </span>
      </div>
      <div className="flex gap-3 text-[10px] text-muted-foreground/80 pl-0.5">
        {alert.traceId && <span>trace {shortTrace(alert.traceId)}</span>}
        {alert.path && <span className="truncate">{alert.path}</span>}
      </div>
    </button>
  )
}
