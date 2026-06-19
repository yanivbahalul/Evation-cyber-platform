'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Loader2,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react'
import type { HrTicket, HrTicketStatus } from '@/lib/types/hrTicket'

type FilterMode = 'all' | 'suspicious' | 'open'

const SOURCE_LABELS: Record<HrTicket['source'], string> = {
  profile_edit: 'Profile edit',
  contact: 'Contact form',
  dashboard: 'Dashboard',
}

const REASON_LABELS: Record<string, string> = {
  credential_request: 'Credential request',
  financial_fraud: 'Financial fraud language',
  payment_fraud: 'Payment fraud language',
  bec_language: 'BEC / executive urgency',
  secret_request: 'Secret / key request',
  auth_bypass: 'Auth bypass request',
  privilege_escalation: 'Privilege escalation',
  pii_harvest: 'PII harvest',
  xss_marker: 'XSS marker',
  sqli_marker: 'SQLi marker',
  unauthenticated_profile_edit: 'Unauthenticated profile edit',
  low_effort_probe: 'Low-effort probe',
}

function reasonLabel(reason: string) {
  return REASON_LABELS[reason] ?? reason.replace(/_/g, ' ')
}

export default function HrTicketsPanel() {
  const [tickets, setTickets] = useState<HrTicket[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<FilterMode>('all')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const loadTickets = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ limit: '200' })
      if (filter === 'suspicious') params.set('suspicious', '1')
      if (filter === 'open') params.set('status', 'open')

      const res = await fetch(`/api/admin/tickets?${params}`, { credentials: 'include' })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error || 'Failed to load tickets')
      setTickets(json.data ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load tickets')
    } finally {
      setLoading(false)
    }
  }, [filter])

  useEffect(() => {
    loadTickets()
  }, [loadTickets])

  const stats = useMemo(() => {
    const suspicious = tickets.filter(t => t.isSuspicious).length
    const open = tickets.filter(t => t.status === 'open').length
    return { total: tickets.length, suspicious, open }
  }, [tickets])

  const updateStatus = async (ticketId: string, status: HrTicketStatus) => {
    setBusyId(ticketId)
    setError(null)
    try {
      const res = await fetch('/api/admin/tickets', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticketId, status }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error || 'Update failed')
      setTickets(prev => prev.map(t => (t.ticketId === ticketId ? json.data : t)))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Update failed')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="flex flex-col gap-4 h-full">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-primary" />
            IT Tickets
          </h2>
          <p className="text-xs text-muted-foreground font-mono mt-1">
            Helpdesk queue from the Safe Zone portal — includes profile-edit and IT support submissions.
          </p>
        </div>
        <button
          type="button"
          onClick={loadTickets}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-mono border border-border bg-surface hover:bg-surface-elevated disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatCard label="Loaded" value={stats.total} icon={ClipboardList} color="text-primary" />
        <StatCard label="Open" value={stats.open} icon={AlertTriangle} color="text-accent" />
        <StatCard label="Suspicious" value={stats.suspicious} icon={ShieldAlert} color="text-danger" />
      </div>

      <div className="flex flex-wrap gap-2">
        {(['all', 'open', 'suspicious'] as FilterMode[]).map(mode => (
          <button
            key={mode}
            type="button"
            onClick={() => setFilter(mode)}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono border transition-colors ${
              filter === mode
                ? 'bg-primary/15 text-primary border-primary/30'
                : 'bg-surface text-muted-foreground border-border hover:text-foreground'
            }`}
          >
            {mode === 'all' ? 'All tickets' : mode === 'open' ? 'Open only' : 'Suspicious only'}
          </button>
        ))}
      </div>

      {error && (
        <div className="text-xs font-mono text-danger bg-danger/10 border border-danger/30 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      <div className="flex-1 overflow-auto border border-border rounded-xl bg-surface">
        {loading && tickets.length === 0 ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground text-xs font-mono gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading tickets…
          </div>
        ) : tickets.length === 0 ? (
          <div className="flex items-center justify-center py-16 text-xs text-muted-foreground font-mono">
            No tickets match this filter.
          </div>
        ) : (
          <div className="divide-y divide-border">
            {tickets.map(ticket => {
              const expanded = expandedId === ticket.ticketId
              return (
                <div
                  key={ticket.ticketId}
                  className={ticket.isSuspicious ? 'bg-danger/5' : ''}
                >
                  <button
                    type="button"
                    onClick={() => setExpandedId(expanded ? null : ticket.ticketId)}
                    className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-surface-elevated transition-colors"
                  >
                    <div className={`mt-0.5 p-2 rounded-lg border ${
                      ticket.isSuspicious
                        ? 'bg-danger/10 border-danger/30 text-danger'
                        : 'bg-success/10 border-success/20 text-success'
                    }`}>
                      {ticket.isSuspicious
                        ? <ShieldAlert className="w-4 h-4" />
                        : <ShieldCheck className="w-4 h-4" />}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-mono font-bold text-foreground">{ticket.ticketId}</span>
                        <StatusBadge status={ticket.status} />
                        {ticket.isSuspicious && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-danger/20 text-danger border border-danger/30">
                            SUSPICIOUS
                          </span>
                        )}
                        <span className="text-[10px] font-mono text-muted-foreground">
                          {SOURCE_LABELS[ticket.source]}
                        </span>
                      </div>
                      <p className="text-sm text-foreground mt-1 truncate">{ticket.subject}</p>
                      <p className="text-[10px] font-mono text-muted-foreground mt-1">
                        {ticket.submittedBy ? `@${ticket.submittedBy}` : 'Anonymous'}
                        {' · '}
                        {ticket.submitterIp}
                        {' · '}
                        {ticket.createdAt
                          ? formatDistanceToNow(new Date(ticket.createdAt), { addSuffix: true })
                          : '—'}
                      </p>
                    </div>

                    {expanded
                      ? <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0 mt-1" />
                      : <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0 mt-1" />}
                  </button>

                  {expanded && (
                    <div className="px-4 pb-4 pl-14 space-y-3">
                      <pre className="text-[11px] font-mono whitespace-pre-wrap break-words bg-background border border-border rounded-lg p-3 text-foreground/90 max-h-48 overflow-auto">
                        {ticket.message}
                      </pre>

                      {ticket.suspiciousReasons.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {ticket.suspiciousReasons.map(reason => (
                            <span
                              key={reason}
                              className="text-[10px] font-mono px-2 py-0.5 rounded bg-danger/10 text-danger border border-danger/20"
                            >
                              {reasonLabel(reason)}
                            </span>
                          ))}
                        </div>
                      )}

                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[10px] font-mono text-muted-foreground">Status:</span>
                        {(['open', 'in_review', 'closed'] as HrTicketStatus[]).map(status => (
                          <button
                            key={status}
                            type="button"
                            disabled={busyId === ticket.ticketId || ticket.status === status}
                            onClick={() => updateStatus(ticket.ticketId, status)}
                            className={`text-[10px] font-mono px-2 py-1 rounded border transition-colors disabled:opacity-40 ${
                              ticket.status === status
                                ? 'bg-primary/15 text-primary border-primary/30'
                                : 'bg-surface text-muted-foreground border-border hover:text-foreground'
                            }`}
                          >
                            {status.replace('_', ' ')}
                          </button>
                        ))}
                        {ticket.traceId && (
                          <span className="text-[10px] font-mono text-muted-foreground ml-auto">
                            trace: {ticket.traceId.slice(0, 12)}…
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

function StatCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string
  value: number
  icon: React.ElementType
  color: string
}) {
  return (
    <div className="bg-surface border border-border rounded-xl px-4 py-3 flex items-center gap-3">
      <div className={`p-2 rounded-lg bg-surface-elevated ${color}`}>
        <Icon className="w-4 h-4" />
      </div>
      <div>
        <p className={`text-2xl font-bold ${color} leading-none`}>{value}</p>
        <p className="text-[10px] font-mono text-muted-foreground mt-0.5">{label}</p>
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: HrTicketStatus }) {
  const styles: Record<HrTicketStatus, string> = {
    open: 'bg-accent/15 text-accent border-accent/30',
    in_review: 'bg-primary/15 text-primary border-primary/30',
    closed: 'bg-muted text-muted-foreground border-border',
  }
  return (
    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${styles[status]}`}>
      {status.replace('_', ' ').toUpperCase()}
    </span>
  )
}
