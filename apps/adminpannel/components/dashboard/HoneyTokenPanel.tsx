'use client'

import { useState } from 'react'
import { useSocket, type HoneyToken } from '@/context/SocketContext'
import { Key, ShieldAlert, ShieldCheck, Clock, Globe, ChevronDown, ChevronRight, Eye, EyeOff } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

/**
 * HoneyTokenPanel — renders all HoneyToken documents from the telemetry DB.
 *
 * Each token shows:
 *   - fakeUsername / fakePassword (masked by default)
 *   - isTriggered status
 *   - triggeredLogs[] — additive forensics (who, when, where)
 *     per the HoneyTokenSchema spec.
 */
export default function HoneyTokenPanel() {
  const { honeyTokens } = useSocket()
  const triggered  = honeyTokens.filter(t => t.isTriggered)
  const untriggered = honeyTokens.filter(t => !t.isTriggered)

  return (
    <div className="flex flex-col gap-5 h-full overflow-y-auto">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <SummaryCard label="Total Tokens"  value={honeyTokens.length}    color="text-primary"    icon={Key} />
        <SummaryCard label="Triggered"     value={triggered.length}      color="text-accent"     icon={ShieldAlert} />
        <SummaryCard label="Intact"        value={untriggered.length}    color="text-success"    icon={ShieldCheck} />
      </div>

      {/* Triggered section */}
      {triggered.length > 0 && (
        <section>
          <h3 className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest text-accent mb-3">
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

function TokenCard({ token }: { token: HoneyToken }) {
  const [expanded, setExpanded] = useState(false)
  const [showCreds, setShowCreds] = useState(false)

  return (
    <div className={`bg-surface border rounded-xl overflow-hidden transition-all ${
      token.isTriggered ? 'border-accent/40' : 'border-border'
    }`}>
      {/* Card header */}
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-surface-elevated transition-colors"
        onClick={() => setExpanded(v => !v)}
      >
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
          token.isTriggered ? 'bg-accent/15 border border-accent/30' : 'bg-success/10 border border-success/20'
        }`}>
          <Key className={`w-4 h-4 ${token.isTriggered ? 'text-accent' : 'text-success'}`} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-mono font-bold text-foreground">{token.fakeUsername}</span>
            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
              token.isTriggered
                ? 'bg-accent/20 text-accent border border-accent/30'
                : 'bg-success/10 text-success border border-success/20'
            }`}>
              {token.isTriggered ? 'TRIGGERED' : 'INTACT'}
            </span>
          </div>
          <p className="text-[10px] font-mono text-muted-foreground mt-0.5">
            {token.triggeredLogs.length} forensic log{token.triggeredLogs.length !== 1 ? 's' : ''}
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

      {/* Credentials row */}
      {showCreds && (
        <div className="mx-4 mb-3 bg-surface-elevated border border-border rounded-lg p-3 text-xs font-mono">
          <div className="flex gap-4">
            <span className="text-muted-foreground/60 shrink-0">fakeUsername:</span>
            <span className="text-primary">{token.fakeUsername}</span>
          </div>
          <div className="flex gap-4 mt-1">
            <span className="text-muted-foreground/60 shrink-0">fakePassword:</span>
            <span className="text-accent">{token.fakePassword}</span>
          </div>
        </div>
      )}

      {/* Triggered logs */}
      {expanded && token.triggeredLogs.length > 0 && (
        <div className="border-t border-border px-4 py-3">
          <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest mb-2">
            Additive Forensics Log
          </p>
          <div className="flex flex-col gap-2">
            {token.triggeredLogs.map((log, i) => (
              <div key={i} className="flex items-start gap-3 bg-surface-elevated border border-border rounded-lg px-3 py-2 text-xs font-mono">
                <span className="text-muted-foreground/50 shrink-0">{String(i + 1).padStart(2, '0')}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Globe className="w-3 h-3 text-muted-foreground shrink-0" />
                    <span className="text-foreground font-bold">{log.attackerIp}</span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-primary/15 text-primary border border-primary/20">
                      {log.networkContext}
                    </span>
                  </div>
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

function SummaryCard({ label, value, color, icon: Icon }: { label: string; value: number; color: string; icon: React.ElementType }) {
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
