'use client'

import { useState } from 'react'
import { Copy, Search } from 'lucide-react'
import type { AttackEvent } from '@/lib/types/telemetry'
import { formatPayload, trapLabel } from '@/lib/attackIntel'
import { useInvestigation } from '@/features/investigation/context/InvestigationContext'

const TRAP_COLORS: Record<string, string> = {
  SQL_INJECTION: '#ef4444',
  HONEY_TOKEN: '#f97316',
  DATA_BOMB: '#f59e0b',
  PATH_TRAVERSAL: '#8b5cf6',
  BRUTE_FORCE: '#ec4899',
  XSS_PROBE: '#06b6d4',
  RECON: '#64748b',
  SSRF: '#14b8a6',
  SCANNER: '#a855f7',
}

interface EventDetailPanelProps {
  event: AttackEvent
  onClose: () => void
}

export default function EventDetailPanel({ event, onClose }: EventDetailPanelProps) {
  const { openInvestigation } = useInvestigation()
  const [copied, setCopied] = useState(false)
  const color = TRAP_COLORS[event.trapType] ?? '#7a9bb5'

  const copyPayload = async () => {
    try {
      await navigator.clipboard.writeText(formatPayload(event.payload))
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // ignore
    }
  }

  return (
    <div className="bg-surface border border-primary/30 rounded-xl p-4 text-xs font-mono">
      <div className="flex items-center justify-between mb-3 gap-2">
        <span className="text-primary font-bold uppercase tracking-widest text-[10px]">Event Detail</span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() =>
              openInvestigation({ ip: event.attackerIp, traceId: event.traceId })
            }
            className="flex items-center gap-1 px-2 py-1 rounded-md bg-primary/15 text-primary border border-primary/30 hover:bg-primary/25 text-[10px]"
          >
            <Search className="w-3 h-3" />
            Investigate attacker
          </button>
          <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground">
            ✕
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 mb-3">
        <Row label="eventID" value={event.eventID} />
        <Row label="traceId" value={event.traceId ?? '—'} fullWidth />
        <Row label="attackerIp" value={event.attackerIp} />
        <Row
          label="trapType"
          value={event.trapType}
          highlight={color}
          sub={trapLabel(event.trapType)}
        />
        <Row label="method" value={event.method ?? '—'} />
        <Row label="path" value={event.path ?? '—'} />
        <Row label="wasted_time" value={`${event.wasted_time_ms}ms`} />
        <Row label="bytes_sent" value={`${event.bytes_sent}B`} />
        <Row label="timestamp" value={new Date(event.timestamp).toISOString()} />
        <Row label="handoffFrom" value={event.handoffFrom ?? '—'} />
        <Row label="xssTier" value={event.xssTier ?? '—'} />
        <Row
          label="secondaryTraps"
          value={event.secondaryTraps?.length ? event.secondaryTraps.join(', ') : '—'}
        />
      </div>

      {event.fingerprint && (
        <Section title="Fingerprint">
          <Row label="os" value={event.fingerprint.os ?? '—'} />
          <Row label="platform" value={event.fingerprint.platform ?? '—'} />
          <Row label="browser" value={event.fingerprint.browserVersion ?? event.fingerprint.browser ?? '—'} />
          <Row label="device" value={event.fingerprint.deviceType ?? '—'} />
          <Row
            label="isBot"
            value={String(event.fingerprint.isBot ?? false)}
            highlight={event.fingerprint.isBot ? '#ef4444' : '#22c55e'}
          />
          <Row label="riskScore" value={event.fingerprint.riskScore != null ? String(event.fingerprint.riskScore) : '—'} />
        </Section>
      )}

      <Section title="Request">
        <Row label="userAgent" value={event.userAgent ?? '—'} />
        <Row label="referer" value={event.referer ?? '—'} />
      </Section>

      <Section title="Payload">
        <div className="flex justify-end mb-1">
          <button
            type="button"
            onClick={copyPayload}
            className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground"
          >
            <Copy className="w-3 h-3" />
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
        <pre className="max-h-40 overflow-auto p-2 rounded-lg bg-background border border-border text-[10px] text-accent/90 whitespace-pre-wrap break-all">
          {formatPayload(event.payload)}
        </pre>
      </Section>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-3 pt-3 border-t border-border">
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">{title}</p>
      <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">{children}</div>
    </div>
  )
}

function Row({
  label,
  value,
  highlight,
  sub,
  fullWidth,
}: {
  label: string
  value: string
  highlight?: string
  sub?: string
  fullWidth?: boolean
}) {
  return (
    <div className={`flex flex-col gap-0.5 ${fullWidth ? 'col-span-2' : 'col-span-1'}`}>
      <div className="flex gap-2">
        <span className="text-muted-foreground/60 shrink-0">{label}:</span>
        <span style={highlight ? { color: highlight } : {}} className="text-foreground break-all">
          {value}
        </span>
      </div>
      {sub && <span className="text-[10px] text-muted-foreground/70 pl-0">{sub}</span>}
    </div>
  )
}
