'use client'

import dynamic from 'next/dynamic'
import { Activity, ArrowRight, Ban, Clock3, MapPin, ShieldAlert, Users } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { useSocket } from '@/features/dashboard/context/SocketContext'
import { useInvestigation } from '@/features/investigation/context/InvestigationContext'
import { geoLocationLabel } from '@/lib/geoDisplay'
import type { ActiveTab } from './Sidebar'

const LeafletMap = dynamic(() => import('./LeafletMap'), { ssr: false })

export default function Overview({ onSelectTab }: { onSelectTab: (tab: ActiveTab) => void }) {
  const { mergedAttackEvents, displayAlerts, attackerProfiles } = useSocket()
  const { openInvestigation } = useInvestigation()
  const profileByIp = new Map(attackerProfiles.map(profile => [profile.ip, profile]))
  const uniqueAttackers = new Set([
    ...mergedAttackEvents.map(event => event.attackerIp),
    ...attackerProfiles.map(profile => profile.ip),
  ]).size
  const highRisk = attackerProfiles.filter(profile => profile.riskScore >= 80).length
  const banned = attackerProfiles.filter(profile => profile.banned).length
  const recentEvents = mergedAttackEvents.slice(0, 8)
  const recentAlerts = displayAlerts.slice(0, 7)

  const investigate = (ip: string, traceId?: string) => {
    openInvestigation({ ip, traceId })
  }

  return (
    <div className="flex min-h-full flex-col gap-5">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Security Overview</h1>
        <p className="mt-1 text-sm text-muted-foreground">Live deception telemetry and attacker activity.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <MetricCard label="Total Attack Events" value={mergedAttackEvents.length} icon={Activity} />
        <MetricCard label="Unique Attackers" value={uniqueAttackers} icon={Users} />
        <MetricCard label="High Risk Attackers" value={highRisk} icon={ShieldAlert} tone="text-danger" />
        <MetricCard label="Banned IPs" value={banned} icon={Ban} tone="text-danger" />
      </div>

      <div className="grid min-h-[430px] grid-cols-1 gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(290px,1fr)]">
        <section className="flex min-h-[430px] flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div>
              <h2 className="text-sm font-semibold text-foreground">Threat Map</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">Observed attacker locations</p>
            </div>
            <button type="button" onClick={() => onSelectTab('map')} className="text-xs font-medium text-primary hover:underline">
              Open map
            </button>
          </div>
          <div className="min-h-[360px] flex-1"><LeafletMap /></div>
        </section>

        <section className="flex min-h-[430px] flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
          <div className="border-b border-border px-4 py-3">
            <h2 className="text-sm font-semibold text-foreground">Recent Attacks</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">Newest observed activity</p>
          </div>
          <div className="flex-1 overflow-y-auto">
            {recentAlerts.length ? recentAlerts.map(alert => (
              <button
                key={alert.eventID}
                type="button"
                onClick={() => investigate(alert.attackerIp, alert.traceId)}
                className="w-full border-b border-border px-4 py-3 text-left transition-colors last:border-0 hover:bg-surface-elevated"
              >
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-semibold text-foreground">{alert.attackerIp}</span>
                  <span className="ml-auto text-[10px] text-muted-foreground">
                    {formatDistanceToNow(new Date(alert.timestamp), { addSuffix: true })}
                  </span>
                </div>
                <div className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <ShieldAlert className="h-3 w-3 text-warning" />
                  <span className="font-medium text-foreground">{alert.trapType.replace(/_/g, ' ')}</span>
                  <span>·</span>
                  <MapPin className="h-3 w-3" />
                  <span className="truncate">{geoLocationLabel(alert.city, alert.country)}</span>
                </div>
              </button>
            )) : (
              <div className="flex h-full items-center justify-center px-4 text-sm text-muted-foreground">No recent attacks.</div>
            )}
          </div>
        </section>
      </div>

      <section className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Recent Attack Events</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">Latest correlated activity across deception services</p>
          </div>
          <button type="button" onClick={() => onSelectTab('events')} className="flex items-center gap-1 text-xs font-medium text-primary hover:underline">
            View all events <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-left text-xs">
            <thead className="bg-surface-elevated text-[10px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 font-semibold">Attacker IP</th>
                <th className="px-4 py-2.5 font-semibold">Attack Type</th>
                <th className="px-4 py-2.5 font-semibold">Location</th>
                <th className="px-4 py-2.5 font-semibold">Wasted Time</th>
                <th className="px-4 py-2.5 font-semibold">Time</th>
              </tr>
            </thead>
            <tbody>
              {recentEvents.map(event => {
                const profile = profileByIp.get(event.attackerIp)
                return (
                  <tr
                    key={event.eventID}
                    onClick={() => investigate(event.attackerIp, event.traceId)}
                    className="cursor-pointer border-t border-border transition-colors hover:bg-surface-elevated"
                  >
                    <td className="px-4 py-3 font-mono font-medium text-foreground">{event.attackerIp}</td>
                    <td className="px-4 py-3"><span className="rounded-md bg-surface-elevated px-2 py-1 text-[10px] font-medium text-foreground">{event.trapType.replace(/_/g, ' ')}</span></td>
                    <td className="px-4 py-3 text-muted-foreground">{profile ? geoLocationLabel(profile.city, profile.country) : 'Unknown'}</td>
                    <td className="px-4 py-3 font-mono text-muted-foreground">{(event.wasted_time_ms / 1000).toFixed(1)}s</td>
                    <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{formatDistanceToNow(new Date(event.timestamp), { addSuffix: true })}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {!recentEvents.length && <div className="px-4 py-10 text-center text-sm text-muted-foreground">No attack events yet.</div>}
        </div>
      </section>
    </div>
  )
}

function MetricCard({ label, value, icon: Icon, tone = 'text-primary' }: { label: string; value: number; icon: React.ElementType; tone?: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <Icon className={`h-4 w-4 ${tone}`} />
      </div>
      <p className="mt-3 text-2xl font-semibold tabular-nums text-foreground">{value.toLocaleString()}</p>
      <p className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground"><Clock3 className="h-3 w-3" /> Current dataset</p>
    </div>
  )
}
