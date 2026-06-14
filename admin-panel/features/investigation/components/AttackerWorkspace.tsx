'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Bot, Clock, Lightbulb, MapPin, RefreshCw, User } from 'lucide-react'
import { useSocket } from '@/features/dashboard/context/SocketContext'
import { useInvestigation } from '@/features/investigation/context/InvestigationContext'
import type { AttackEvent, AttackerProfile, AttackerTimeline } from '@/lib/types/telemetry'
import { deltaMs, learningHints, shortTrace, trapLabel } from '@/lib/attackIntel'
import { formatDistanceToNow } from 'date-fns'

const TRAP_COLORS: Record<string, string> = {
  SQL_INJECTION: '#ef4444',
  BRUTE_FORCE: '#ec4899',
  RECON: '#64748b',
  HONEY_TOKEN: '#f97316',
  DATA_BOMB: '#f59e0b',
  PATH_TRAVERSAL: '#8b5cf6',
  XSS_PROBE: '#06b6d4',
  SSRF: '#14b8a6',
  SCANNER: '#a855f7',
}

export default function AttackerWorkspace() {
  const { demoMode, attackEvents, attackerProfiles, getTimelineForIp } = useSocket()
  const { target, openInvestigation, clearInvestigation } = useInvestigation()
  const [ipInput, setIpInput] = useState(target?.ip ?? '')
  const [traceInput, setTraceInput] = useState(target?.traceId ?? '')
  const [timeline, setTimeline] = useState<AttackerTimeline | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    setIpInput(target?.ip ?? '')
    setTraceInput(target?.traceId ?? '')
  }, [target])

  const loadTimeline = useCallback(async () => {
    const ip = ipInput.trim()
    if (!ip) return

    const trace = traceInput.trim()
    setLoadError(null)
    const instant = !demoMode ? getTimelineForIp(ip, trace || undefined) : null
    if (instant && (instant.profile || instant.events.length > 0)) {
      setTimeline(normalizeTimeline(instant, ip))
      setLoading(false)
    } else {
      setLoading(true)
      setTimeline(null)
    }

    try {
      if (demoMode) {
        const profile =
          attackerProfiles.find(p => p.ip === ip) ??
          ({
            ip,
            city: 'Demo City',
            lat: 0,
            lng: 0,
            os: 'Linux',
            browser: 'curl/7.85',
            isBot: true,
            riskScore: 88,
            firstSeen: new Date().toISOString(),
            lastSeen: new Date().toISOString(),
            traceIds: ['demo-trace-001'],
          } as AttackerProfile)
        let events = attackEvents.filter(e => e.attackerIp === ip)
        if (traceInput.trim()) {
          events = events.filter(e => e.traceId === traceInput.trim() || !e.traceId)
        }
        events = [...events].sort(
          (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
        )
        setTimeline(normalizeTimeline({ profile, events }, ip))
        return
      }

      const q = new URLSearchParams()
      if (traceInput.trim()) q.set('traceId', traceInput.trim())
      const res = await fetch(
        `/api/admin/attackers/${encodeURIComponent(ip)}/timeline?${q}`,
        { method: 'GET', credentials: 'include' },
      )
      const json = (await res.json().catch(() => null)) as
        | { success: true; data: AttackerTimeline }
        | { success: false; error?: string }
        | null
      if (!res.ok || !json || (json as { success?: boolean }).success !== true) {
        const msg =
          (json as { error?: string })?.error ||
          (res.status === 401 ? 'Unauthorized — sign in as admin.' : `Failed (${res.status})`)
        setLoadError(msg)
        setTimeline(null)
        return
      }
      const data = (json as { data: AttackerTimeline }).data
      setTimeline(normalizeTimeline(data, ip))
      if (!data.events?.length && traceInput.trim()) {
        setLoadError('No events for this traceId. Try clearing traceId or pick another trace chip.')
      }
    } finally {
      setLoading(false)
    }
  }, [ipInput, traceInput, demoMode, attackEvents, attackerProfiles, getTimelineForIp])

  useEffect(() => {
    if (target?.ip) loadTimeline()
  }, [target?.ip, target?.traceId, loadTimeline])

  const hints = useMemo(() => {
    if (!timeline?.events.length) return []
    const ua = timeline.events.find(e => e.userAgent)?.userAgent
    return learningHints(timeline.events, ua)
  }, [timeline])

  const traceOptions = useMemo(() => {
    const ids = new Set<string>()
    timeline?.profile?.traceIds?.forEach(id => ids.add(id))
    timeline?.events.forEach(e => e.traceId && ids.add(e.traceId))
    return [...ids]
  }, [timeline])

  return (
    <div className="flex flex-col gap-4 h-full min-h-0">
      <div className="bg-surface border border-border rounded-xl p-4">
        <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-3">
          Select attacker session
        </p>
        <div className="flex flex-wrap gap-3 items-end">
          <label className="flex flex-col gap-1 text-xs font-mono">
            <span className="text-muted-foreground">IP address</span>
            <input
              value={ipInput}
              onChange={e => setIpInput(e.target.value)}
              placeholder="185.220.101.5"
              className="bg-background border border-border rounded-lg px-3 py-2 text-foreground min-w-[180px]"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-mono">
            <span className="text-muted-foreground">traceId (optional)</span>
            <input
              value={traceInput}
              onChange={e => setTraceInput(e.target.value)}
              placeholder="filter one session"
              className="bg-background border border-border rounded-lg px-3 py-2 text-foreground min-w-[200px]"
            />
          </label>
          <button
            type="button"
            onClick={() => {
              openInvestigation({ ip: ipInput.trim(), traceId: traceInput.trim() || undefined })
              loadTimeline()
            }}
            disabled={!ipInput.trim() || loading}
            className="px-4 py-2 rounded-lg bg-primary/20 text-primary border border-primary/30 text-xs font-mono hover:bg-primary/30 disabled:opacity-50"
          >
            Load timeline
          </button>
          {target && (
            <button
              type="button"
              onClick={clearInvestigation}
              className="px-3 py-2 rounded-lg text-xs font-mono text-muted-foreground border border-border hover:text-foreground"
            >
              Clear
            </button>
          )}
        </div>
        {traceOptions.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {traceOptions.map(id => (
              <button
                key={id}
                type="button"
                onClick={() => {
                  setTraceInput(id)
                  openInvestigation({ ip: ipInput.trim(), traceId: id })
                }}
                className={`text-[10px] font-mono px-2 py-1 rounded border ${
                  traceInput === id
                    ? 'border-primary/50 bg-primary/10 text-primary'
                    : 'border-border text-muted-foreground hover:border-border-bright'
                }`}
              >
                {shortTrace(id)}
              </button>
            ))}
          </div>
        )}
      </div>

      {loading && (
        <div className="text-xs font-mono text-muted-foreground flex items-center gap-2">
          <RefreshCw className="w-4 h-4 animate-spin" />
          Loading attacker timeline…
        </div>
      )}

      {loadError && !loading && (
        <div className="text-xs font-mono text-danger border border-danger/30 bg-danger/10 rounded-lg px-3 py-2">
          {loadError}
        </div>
      )}

      {timeline && (timeline.profile || timeline.events.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 min-h-0 flex-1">
          <div className="lg:col-span-1 bg-surface border border-border rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2">
              {timeline.profile?.isBot ? (
                <Bot className="w-5 h-5 text-danger" />
              ) : (
                <User className="w-5 h-5 text-muted-foreground" />
              )}
              <span className="font-mono font-bold text-foreground">{timeline.profile?.ip ?? ipInput}</span>
            </div>
            {timeline.profile?.city && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-mono">
                <MapPin className="w-3 h-3" />
                {timeline.profile.city}
              </div>
            )}
            {(timeline.profile?.os || timeline.profile?.browser) && (
              <p className="text-xs font-mono text-muted-foreground">
                {[timeline.profile.os, timeline.profile.browser].filter(Boolean).join(' · ')}
              </p>
            )}
            {timeline.profile && (
              <>
                <p className="text-xs font-mono">
                  Risk: <span className="text-accent font-bold">{timeline.profile.riskScore}/100</span>
                </p>
                <p className="text-[10px] font-mono text-muted-foreground/70">
                  First seen{' '}
                  {formatDistanceToNow(new Date(timeline.profile.firstSeen), { addSuffix: true })}
                </p>
              </>
            )}
            {!timeline.profile && (
              <p className="text-[10px] font-mono text-muted-foreground/70">
                No attacker profile yet — showing events only.
              </p>
            )}

            <div className="pt-3 border-t border-border">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-1">
                <Lightbulb className="w-3 h-3 text-accent" />
                Learning notes
              </p>
              <ul className="space-y-2">
                {hints.map((hint) => (
                  <li key={hint} className="text-[11px] font-mono text-muted-foreground leading-relaxed">
                    • {hint}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="lg:col-span-2 bg-surface border border-border rounded-xl p-4 overflow-y-auto min-h-[320px]">
            <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-4">
              Kill chain ({timeline.events.length} events)
            </p>
            {timeline.events.length === 0 ? (
              <p className="text-xs font-mono text-muted-foreground">No events for this filter.</p>
            ) : (
              <div className="relative pl-6 border-l border-border space-y-6">
                {timeline.events.map((evt, idx) => (
                  <TimelineNode
                    key={evt.eventID}
                    event={evt}
                    prev={idx > 0 ? timeline.events[idx - 1] : undefined}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {!timeline && !loading && (
        <div className="flex-1 flex items-center justify-center text-xs font-mono text-muted-foreground border border-dashed border-border rounded-xl">
          Enter an attacker IP from the event log or map feed, then load their deception timeline.
        </div>
      )}
    </div>
  )
}

/** UI requires a profile object; API may return events without AttackerProfile row. */
function normalizeTimeline(data: AttackerTimeline, ip: string): AttackerTimeline {
  const events = data.events ?? []
  if (data.profile) return { profile: data.profile, events }
  if (events.length === 0) return { profile: null, events }
  const first = events[0]
  const fp = first.fingerprint
  return {
    profile: {
      ip,
      city: 'Unknown',
      lat: 0,
      lng: 0,
      os: fp?.os ?? '—',
      browser: fp?.browser ?? '—',
      isBot: Boolean(fp?.isBot),
      riskScore: fp?.riskScore ?? 0,
      firstSeen: first.timestamp,
      lastSeen: events[events.length - 1]?.timestamp ?? first.timestamp,
      traceIds: [...new Set(events.map(e => e.traceId).filter(Boolean) as string[])],
    },
    events,
  }
}

function TimelineNode({ event, prev }: { event: AttackEvent; prev?: AttackEvent }) {
  const color = TRAP_COLORS[event.trapType] ?? '#7a9bb5'
  const d = prev ? deltaMs(prev.timestamp, event.timestamp) : null

  return (
    <div className="relative">
      <span
        className="absolute -left-[1.65rem] top-1 w-3 h-3 rounded-full border-2 border-background"
        style={{ background: color }}
      />
      <div className="flex flex-wrap items-center gap-2 mb-1">
        <span
          className="text-[10px] font-bold px-2 py-0.5 rounded"
          style={{ background: `${color}20`, color, border: `1px solid ${color}40` }}
        >
          {event.trapType}
        </span>
        {event.traceId && (
          <span className="text-[10px] font-mono text-muted-foreground">trace {shortTrace(event.traceId)}</span>
        )}
        {d && (
          <span className="text-[10px] font-mono text-accent flex items-center gap-0.5">
            <Clock className="w-3 h-3" />
            {d}
          </span>
        )}
      </div>
      <p className="text-[11px] text-muted-foreground mb-1">{trapLabel(event.trapType)}</p>
      <p className="text-[10px] font-mono text-muted-foreground/80">
        {event.method ?? 'GET'} {event.path ?? '—'} · {formatDistanceToNow(new Date(event.timestamp), { addSuffix: true })}
      </p>
      {event.handoffFrom && (
        <span className="inline-block mt-1 text-[9px] px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
          handoff from {event.handoffFrom}
        </span>
      )}
      {event.payload && (
        <pre className="mt-2 text-[10px] p-2 rounded bg-background border border-border text-accent/80 overflow-x-auto max-h-24">
          {event.payload.length > 200 ? `${event.payload.slice(0, 200)}…` : event.payload}
        </pre>
      )}
      <p className="mt-1 text-[10px] text-success font-mono">
        wasted {(event.wasted_time_ms / 1000).toFixed(1)}s · {event.bytes_sent}B
      </p>
    </div>
  )
}
