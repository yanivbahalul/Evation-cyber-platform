'use client'

import dynamic from 'next/dynamic'
import { AlertTriangle, Clock, MapPin } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { useSocket } from '@/features/dashboard/context/SocketContext'
import { useInvestigation } from '@/features/investigation/context/InvestigationContext'
import { geoLocationLabel } from '@/lib/geoDisplay'

const LeafletMap = dynamic(() => import('./LeafletMap'), { ssr: false })

export default function ThreatMap({ onNavigateInvestigate }: { onNavigateInvestigate?: () => void }) {
  const { displayAlerts, connected, attackerProfiles } = useSocket()
  const { openInvestigation } = useInvestigation()
  const locatedProfiles = attackerProfiles.filter(profile => profile.lat && profile.lng).length

  return (
    <div className="grid min-h-full grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
      <section className="flex min-h-[620px] flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div>
            <h1 className="text-sm font-semibold text-foreground">Geographic Attack Activity</h1>
            <p className="mt-0.5 text-xs text-muted-foreground">Live sources plotted from recorded geolocation data</p>
          </div>
          <div className="flex items-center gap-4 text-[11px] text-muted-foreground">
            <span>{locatedProfiles} located profiles</span>
            <span className="flex items-center gap-1.5"><span className={`h-1.5 w-1.5 rounded-full ${connected ? 'bg-success' : 'bg-muted-foreground'}`} />{connected ? 'Live' : 'Offline'}</span>
          </div>
        </div>
        <div className="min-h-[560px] flex-1"><LeafletMap /></div>
      </section>

      <section className="flex min-h-[620px] flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
        <div className="border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold text-foreground">Map Activity</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">Select an event to investigate</p>
        </div>
        <div className="flex-1 overflow-y-auto">
          {displayAlerts.length ? displayAlerts.slice(0, 14).map(alert => (
            <button
              key={alert.eventID}
              type="button"
              onClick={() => {
                openInvestigation({ ip: alert.attackerIp, traceId: alert.traceId })
                onNavigateInvestigate?.()
              }}
              className="w-full border-b border-border px-4 py-3 text-left transition-colors last:border-0 hover:bg-surface-elevated"
            >
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-semibold text-foreground">{alert.attackerIp}</span>
                <span className="ml-auto flex items-center gap-1 whitespace-nowrap text-[10px] text-muted-foreground"><Clock className="h-3 w-3" />{formatDistanceToNow(new Date(alert.timestamp), { addSuffix: true })}</span>
              </div>
              <div className="mt-1 text-[10px] font-medium text-warning">{alert.trapType.replace(/_/g, ' ')}</div>
              <div className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground"><MapPin className="h-3 w-3" /><span className="truncate">{geoLocationLabel(alert.city, alert.country)}</span></div>
            </button>
          )) : (
            <div className="flex h-full items-center justify-center gap-2 px-6 text-center text-sm text-muted-foreground"><AlertTriangle className="h-4 w-4" />No recent attacks to plot.</div>
          )}
        </div>
      </section>
    </div>
  )
}
