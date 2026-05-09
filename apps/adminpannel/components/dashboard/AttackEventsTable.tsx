'use client'

import { useState } from 'react'
import { useSocket, type AttackEvent, type TrapType } from '@/context/SocketContext'
import { Activity, ChevronDown, ChevronUp, Search, Clock, Database } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

const TRAP_COLORS: Record<TrapType, string> = {
  SQL_INJECTION:  '#ef4444',
  HONEY_TOKEN:    '#f97316',
  DATA_BOMB:      '#f59e0b',
  PATH_TRAVERSAL: '#8b5cf6',
  BRUTE_FORCE:    '#ec4899',
  XSS_PROBE:      '#06b6d4',
}

export default function AttackEventsTable() {
  const { attackEvents, liveAlerts } = useSocket()
  const [search, setSearch] = useState('')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [selected, setSelected] = useState<AttackEvent | null>(null)

  // Merge live alerts into the event list for real-time updates
  const liveAsEvents: AttackEvent[] = liveAlerts.map(a => ({
    eventID:      a.eventID,
    attackerIp:   a.attackerIp,
    trapType:     a.trapType,
    payload:      a.payload,
    wasted_time_ms: a.wastedTimeMs,
    bytes_sent:   a.bytesSent ?? 0,
    timestamp:    a.timestamp,
  }))

  const allEvents = [...liveAsEvents, ...attackEvents]
  const filtered = allEvents.filter(e =>
    String(e.attackerIp ?? '').includes(search) ||
    String(e.trapType ?? '').toLowerCase().includes(search.toLowerCase()) ||
    String(e.payload ?? '').toLowerCase().includes(search.toLowerCase())
  )
  const sorted = [...filtered].sort((a, b) => {
    const diff = new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    return sortDir === 'desc' ? -diff : diff
  })

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* Stat cards */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Total Events" value={allEvents.length} icon={Activity} color="text-primary" />
        <StatCard label="Unique IPs" value={new Set(allEvents.map(e => e.attackerIp)).size} icon={Database} color="text-accent" />
        <StatCard label="Avg Wasted" value={`${Math.round(allEvents.reduce((s,e) => s + e.wasted_time_ms, 0) / Math.max(allEvents.length,1) / 1000)}s`} icon={Clock} color="text-chart-3" />
      </div>

      {/* Search + sort */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Filter by IP, trap type, payload..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-surface border border-border rounded-lg pl-8 pr-4 py-2 text-xs font-mono text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary transition-colors"
          />
        </div>
        <button
          onClick={() => setSortDir(d => d === 'desc' ? 'asc' : 'desc')}
          className="flex items-center gap-1.5 px-3 py-2 bg-surface border border-border rounded-lg text-xs font-mono text-muted-foreground hover:text-foreground hover:border-border-bright transition-colors"
        >
          {sortDir === 'desc' ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
          {sortDir === 'desc' ? 'Newest' : 'Oldest'}
        </button>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto rounded-xl border border-border min-h-0">
        <table className="w-full text-xs font-mono border-collapse">
          <thead className="sticky top-0 z-10">
            <tr className="bg-surface-elevated border-b border-border">
              {['Event ID', 'IP', 'Trap Type', 'Payload', 'Wasted', 'Bytes', 'When'].map(h => (
                <th key={h} className="text-left px-4 py-2.5 text-muted-foreground font-semibold uppercase tracking-wider text-[10px] whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map(evt => {
              const color = TRAP_COLORS[evt.trapType] ?? '#7a9bb5'
              const isNew = liveAsEvents.some(l => l.eventID === evt.eventID)
              return (
                <tr
                  key={evt.eventID}
                  onClick={() => setSelected(s => s?.eventID === evt.eventID ? null : evt)}
                  className={`border-b border-border cursor-pointer transition-colors ${
                    selected?.eventID === evt.eventID
                      ? 'bg-primary/10'
                      : isNew
                      ? 'bg-accent/5 hover:bg-accent/10'
                      : 'hover:bg-surface-elevated'
                  }`}
                >
                  <td className="px-4 py-2.5 text-muted-foreground/70 truncate max-w-[80px]">{evt.eventID.slice(0, 8)}…</td>
                  <td className="px-4 py-2.5 text-foreground whitespace-nowrap">{evt.attackerIp}</td>
                  <td className="px-4 py-2.5 whitespace-nowrap">
                    <span
                      className="px-2 py-0.5 rounded text-[10px] font-bold"
                      style={{ background: `${color}20`, color, border: `1px solid ${color}40` }}
                    >
                      {evt.trapType}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground truncate max-w-[140px]">
                    {evt.payload ? <code className="text-accent/80">{evt.payload}</code> : <span className="text-muted-foreground/40">—</span>}
                  </td>
                  <td className="px-4 py-2.5 text-success whitespace-nowrap">{(evt.wasted_time_ms / 1000).toFixed(1)}s</td>
                  <td className="px-4 py-2.5 text-muted-foreground whitespace-nowrap">{evt.bytes_sent}B</td>
                  <td className="px-4 py-2.5 text-muted-foreground/70 whitespace-nowrap">
                    {formatDistanceToNow(new Date(evt.timestamp), { addSuffix: true })}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {sorted.length === 0 && (
          <div className="flex items-center justify-center py-12 text-xs text-muted-foreground font-mono">
            No events match the current filter.
          </div>
        )}
      </div>

      {/* Detail drawer */}
      {selected && (
        <div className="bg-surface border border-primary/30 rounded-xl p-4 text-xs font-mono">
          <div className="flex items-center justify-between mb-3">
            <span className="text-primary font-bold uppercase tracking-widest text-[10px]">Event Detail</span>
            <button onClick={() => setSelected(null)} className="text-muted-foreground hover:text-foreground">✕</button>
          </div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">
            <Row label="eventID"     value={selected.eventID} />
            <Row label="attackerIp"  value={selected.attackerIp} />
            <Row label="trapType"    value={selected.trapType} highlight={TRAP_COLORS[selected.trapType]} />
            <Row label="payload"     value={selected.payload ?? 'null'} />
            <Row label="wasted_time" value={`${selected.wasted_time_ms}ms`} />
            <Row label="bytes_sent"  value={`${selected.bytes_sent}B`} />
            <Row label="timestamp"   value={new Date(selected.timestamp).toISOString()} />
          </div>
        </div>
      )}
    </div>
  )
}

function StatCard({ label, value, icon: Icon, color }: { label: string; value: string | number; icon: React.ElementType; color: string }) {
  return (
    <div className="bg-surface border border-border rounded-xl px-4 py-3 flex items-center gap-3">
      <div className={`p-2 rounded-lg bg-surface-elevated ${color}`}>
        <Icon className="w-4 h-4" />
      </div>
      <div>
        <p className="text-lg font-bold text-foreground leading-none">{value}</p>
        <p className="text-[10px] font-mono text-muted-foreground mt-0.5">{label}</p>
      </div>
    </div>
  )
}

function Row({ label, value, highlight }: { label: string; value: string; highlight?: string }) {
  return (
    <div className="flex gap-2">
      <span className="text-muted-foreground/60 shrink-0">{label}:</span>
      <span style={highlight ? { color: highlight } : {}} className="text-foreground break-all">{value}</span>
    </div>
  )
}
