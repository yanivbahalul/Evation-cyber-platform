'use client'

import { useState } from 'react'
import { useSocket, type HoneyToken } from '@/features/dashboard/context/SocketContext'
import { Key, ShieldAlert, ShieldCheck, Clock, Globe, ChevronDown, ChevronRight, Eye, EyeOff, MapPin, Tag } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

/** Color an HTTP outcome like a real API client would: 2xx ok, 4xx warn, 429 hot. */
const outcomeClasses = (outcome?: number) => {
  if (outcome == null) return 'bg-muted/20 text-muted-foreground border-border'
  if (outcome >= 200 && outcome < 300) return 'bg-success/15 text-success border-success/25'
  if (outcome === 429) return 'bg-warning/10 text-warning border-warning/30'
  if (outcome >= 400) return 'bg-danger/15 text-danger border-danger/25'
  if (outcome >= 300) return 'bg-primary/15 text-primary border-primary/20'
  return 'bg-muted/20 text-muted-foreground border-border'
}

const SummaryCard = ({ label, value, color, icon: Icon }: { label: string; value: number; color: string; icon: React.ElementType }) => {
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

const TokenCard = ({ token }: { token: HoneyToken }) => {
  const [expanded, setExpanded] = useState(false)
  const [showCreds, setShowCreds] = useState(false)

  return (
    <div className={`bg-surface border rounded-xl overflow-hidden transition-all ${
      token.isTriggered ? 'border-warning/40' : 'border-border'
    }`}>
      {/* Card header */}
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-surface-elevated transition-colors"
        onClick={() => setExpanded(v => !v)}
      >
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
          token.isTriggered ? 'bg-warning/10 border border-warning/30' : 'bg-success/10 border border-success/20'
        }`}>
          <Key className={`w-4 h-4 ${token.isTriggered ? 'text-warning' : 'text-success'}`} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-mono font-bold text-foreground">{token.service || token.fakeUsername}</span>
            {token.tokenType && (
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-primary/15 text-primary border border-primary/20 uppercase">
                {token.tokenType}
              </span>
            )}
            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
              token.isTriggered
                ? 'bg-warning/10 text-warning border border-warning/30'
                : 'bg-success/10 text-success border border-success/20'
            }`}>
              {token.isTriggered ? 'TRIGGERED' : 'INTACT'}
            </span>
          </div>
          <p className="text-[10px] font-mono text-muted-foreground mt-0.5 truncate">
            {token.fakeUsername}
            {token.leakSource ? ` · leaked from ${token.leakSource}` : ''}
            {` · ${token.triggeredLogs.length} use${token.triggeredLogs.length !== 1 ? 's' : ''}`}
          </p>
        </div>

        {/* Credentials reveal toggle */}
        <button
          onClick={e => { e.stopPropagation(); setShowCreds(v => !v) }}
          className="p-1.5 rounded-md hover:bg-surface transition-colors text-muted-foreground hover:text-foreground"
          aria-label={showCreds ? 'Hide credentials' : 'Reveal credentials'}
        >
          {showCreds ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>

        {token.triggeredLogs.length > 0 && (
          expanded ? <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
                   : <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
        )}
      </div>

      {/* Credentials + provenance row */}
      {showCreds && (
        <div className="mx-4 mb-3 bg-surface-elevated border border-border rounded-lg p-3 text-xs font-mono">
          <div className="flex gap-4">
            <span className="text-muted-foreground/60 shrink-0 w-24">identity:</span>
            <span className="text-primary break-all">{token.fakeUsername}</span>
          </div>
          <div className="flex gap-4 mt-1">
            <span className="text-muted-foreground/60 shrink-0 w-24">secret:</span>
            <span className="text-accent break-all">{token.fakePassword}</span>
          </div>
          {token.service && (
            <div className="flex gap-4 mt-1">
              <span className="text-muted-foreground/60 shrink-0 w-24">service:</span>
              <span className="text-foreground">{token.service}</span>
            </div>
          )}
          {token.scopes && token.scopes.length > 0 && (
            <div className="flex gap-4 mt-1 items-center">
              <span className="text-muted-foreground/60 shrink-0 w-24 flex items-center gap-1"><Tag className="w-3 h-3" />scopes:</span>
              <span className="flex flex-wrap gap-1">
                {token.scopes.map((s) => (
                  <span key={s} className="text-[9px] px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">{s}</span>
                ))}
              </span>
            </div>
          )}
          {token.leakSource && (
            <div className="flex gap-4 mt-1 items-center">
              <span className="text-muted-foreground/60 shrink-0 w-24 flex items-center gap-1"><MapPin className="w-3 h-3" />leaked from:</span>
              <span className="text-accent">{token.leakSource}</span>
            </div>
          )}
        </div>
      )}

      {/* Triggered logs */}
      {expanded && token.triggeredLogs.length > 0 && (
        <div className="border-t border-border px-4 py-3">
          <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest mb-2">
            Additive Forensics Log
          </p>
          <div className="flex flex-col gap-2">
            {token.triggeredLogs.map((log, index) => (
              <div key={`${log.attackerIp}-${log.timestamp}-${log.networkContext}`} className="flex items-start gap-3 bg-surface-elevated border border-border rounded-lg px-3 py-2 text-xs font-mono">
                <span className="text-muted-foreground/50 shrink-0">{String(index + 1).padStart(2, '0')}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Globe className="w-3 h-3 text-muted-foreground shrink-0" />
                    <span className="text-foreground font-bold">{log.attackerIp}</span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-primary/15 text-primary border border-primary/20">
                      {log.networkContext}
                    </span>
                    {log.outcome != null && (
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${outcomeClasses(log.outcome)}`}>
                        {log.outcome}
                      </span>
                    )}
                  </div>
                  {(log.method || log.path) && (
                    <div className="mt-1 text-muted-foreground/80 break-all">
                      <span className="text-primary font-bold">{log.method || 'GET'}</span> {log.path}
                    </div>
                  )}
                  <div className="flex items-center gap-1 mt-1 text-muted-foreground/70">
                    <Clock className="w-3 h-3 shrink-0" />
                    {formatDistanceToNow(new Date(log.timestamp), { addSuffix: true })}
                    <span className="text-muted-foreground/40 ml-1">({new Date(log.timestamp).toISOString().slice(0, 19)}Z)</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * HoneyTokenPanel — renders all HoneyToken documents from the telemetry DB.
 *
 * Each token shows:
 *   - fakeUsername / fakePassword (masked by default)
 *   - isTriggered status
 *   - triggeredLogs[] — additive forensics (who, when, where)
 *     per the HoneyTokenSchema spec.
 */
const HoneyTokenPanel = () => {
  const { honeyTokens } = useSocket()
  const triggered  = honeyTokens.filter(t => t.isTriggered)
  const untriggered = honeyTokens.filter(t => !t.isTriggered)

  return (
    <div className="flex flex-col gap-5 h-full overflow-y-auto">
      {/* Summary */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <SummaryCard label="Total Tokens"  value={honeyTokens.length}    color="text-primary"    icon={Key} />
        <SummaryCard label="Triggered"     value={triggered.length}      color="text-warning"    icon={ShieldAlert} />
        <SummaryCard label="Intact"        value={untriggered.length}    color="text-success"    icon={ShieldCheck} />
      </div>

      {/* Triggered section */}
      {triggered.length > 0 && (
        <section>
          <h3 className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest text-warning mb-3">
            <ShieldAlert className="w-3.5 h-3.5" />
            Triggered Honey Tokens ({triggered.length})
          </h3>
          <div className="flex flex-col gap-3">
            {triggered.map(t => <TokenCard key={t._id} token={t} />)}
          </div>
        </section>
      )}

      {/* Intact section */}
      <section>
        <h3 className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest text-success mb-3">
          <ShieldCheck className="w-3.5 h-3.5" />
          Intact Honey Tokens ({untriggered.length})
        </h3>
        <div className="flex flex-col gap-3">
          {untriggered.map(t => <TokenCard key={t._id} token={t} />)}
        </div>
      </section>
    </div>
  )
}

export default HoneyTokenPanel
