import type { AttackEvent, MlSeverity, TrapType } from '@/lib/types/telemetry'

export function normalizeTrapType(raw: string): TrapType {
  const map: Record<string, TrapType> = {
    SQLI: 'SQL_INJECTION',
    SQL_INJECTION: 'SQL_INJECTION',
    XSS: 'XSS_PROBE',
    XSS_PROBE: 'XSS_PROBE',
    DATA_BOMB: 'DATA_BOMB',
    BRUTE_FORCE: 'BRUTE_FORCE',
    HONEY_TOKEN: 'HONEY_TOKEN',
    RECON: 'RECON',
    PATH_TRAVERSAL: 'PATH_TRAVERSAL',
    SSRF: 'SSRF',
    SCANNER: 'SCANNER',
  }
  return map[raw] ?? (raw as TrapType)
}

export function trapLabel(trap: TrapType): string {
  const labels: Partial<Record<TrapType, string>> = {
    SQL_INJECTION: 'SQL injection — credential export path',
    SQLI: 'SQL injection — credential export path',
    BRUTE_FORCE: 'Brute force — legacy admin handoff',
    RECON: 'Reconnaissance — internal console',
    HONEY_TOKEN: 'Honey token — API key misuse',
    DATA_BOMB: 'Data bomb — large archive download',
    PATH_TRAVERSAL: 'Path traversal — fake file viewer',
    XSS_PROBE: 'XSS probe — sandbox tier',
    XSS: 'XSS probe — sandbox tier',
    SSRF: 'SSRF — metadata fetch illusion',
    SCANNER: 'Scanner UA — tarpit delay',
  }
  return labels[trap] ?? trap.replace(/_/g, ' ')
}

export function formatPayload(payload?: string): string {
  if (!payload) return '—'
  try {
    const parsed = JSON.parse(payload)
    return JSON.stringify(parsed, null, 2)
  } catch {
    return payload
  }
}

export function shortTrace(traceId?: string): string {
  if (!traceId) return '—'
  return traceId.length > 8 ? `${traceId.slice(0, 8)}…` : traceId
}

/** Preserve order; drop empty/duplicate trace IDs (Mongo may still hold legacy dupes). */
export function uniqueTraceIds(traceIds?: string[]): string[] {
  if (!traceIds?.length) return []
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of traceIds) {
    const id = String(raw).trim()
    if (!id || seen.has(id)) continue
    seen.add(id)
    out.push(id)
  }
  return out
}

export function learningHints(events: AttackEvent[], userAgent?: string): string[] {
  const hints: string[] = []
  const ua = (userAgent || events.find(e => e.userAgent)?.userAgent || '').toLowerCase()
  const traps = events.map(e => normalizeTrapType(e.trapType))

  if (/sqlmap|nikto|acunetix|nmap|masscan|wget\/|curl\//.test(ua)) {
    hints.push('User-Agent suggests automated scanning tooling — prioritize behavior over geolocation alone.')
  }
  if (traps.includes('SQL_INJECTION') && traps.includes('RECON')) {
    hints.push('SQLi followed by internal console access — classic deception kill chain.')
  }
  if (traps.includes('BRUTE_FORCE') && traps.includes('RECON')) {
    hints.push('Brute-force handoff into admin console — attacker believes legacy break-glass worked.')
  }
  if (traps.includes('HONEY_TOKEN') || traps.includes('DATA_BOMB')) {
    hints.push('Post-compromise exfiltration signals — API keys or archive download under trace.')
  }
  const bots = events.filter(e => e.fingerprint?.isBot).length
  if (bots > 0) {
    hints.push(`${bots} event(s) flagged as bot traffic — correlate with scripted payloads.`)
  }
  const handoffs = events.filter(e => e.handoffFrom).length
  if (handoffs > 0) {
    hints.push(`${handoffs} handoff event(s) — attacker was redirected between decoy layers (not a single trap).`)
  }
  if (hints.length === 0) {
    hints.push('Collect more traps on this traceId to build a fuller attacker story.')
  }
  return hints
}

const SEVERITY_RANK: Record<MlSeverity, number> = { benign: 0, suspicious: 1, malicious: 2 }

export function severityColor(severity?: MlSeverity): string {
  switch (severity) {
    case 'malicious':
      return '#ef4444'
    case 'suspicious':
      return '#f59e0b'
    case 'benign':
      return '#22c55e'
    default:
      return '#7a9bb5'
  }
}

export interface MlSummary {
  riskScore: number
  severity?: MlSeverity
  tactics: string[]
  techniques: Array<{ id: string; name: string; tactic: string }>
  threatActor?: { group: string; confidence?: number }
  modelsUsed: string[]
  enrichedCount: number
  engine?: string
}

/** Roll the per-event ML enrichment up into a single attacker-level summary. */
export function summarizeMl(events: AttackEvent[]): MlSummary | null {
  const enriched = events.filter(e => e.mlEnrichment)
  if (enriched.length === 0) return null

  let riskScore = 0
  let severity: MlSeverity | undefined
  const tactics = new Set<string>()
  const techniques = new Map<string, { id: string; name: string; tactic: string }>()
  const models = new Set<string>()
  let actor: { group: string; confidence?: number } | undefined
  let engine: string | undefined

  for (const e of enriched) {
    const ml = e.mlEnrichment
    if (!ml) continue
    if (typeof ml.riskScore === 'number') riskScore = Math.max(riskScore, ml.riskScore)
    if (ml.severity && (!severity || SEVERITY_RANK[ml.severity] > SEVERITY_RANK[severity])) {
      severity = ml.severity
    }
    if (ml.engine) engine = ml.engine
    if (ml.mitre?.tactic) tactics.add(ml.mitre.tactic)
    ml.mitre?.techniques?.forEach(t => {
      if (t.id && !techniques.has(t.id)) techniques.set(t.id, { id: t.id, name: t.name, tactic: t.tactic })
    })
    ml.modelsUsed?.forEach(m => models.add(m))
    const g = ml.threatActor?.group
    if (g && g !== 'Unknown' && (!actor || (ml.threatActor?.confidence ?? 0) > (actor.confidence ?? 0))) {
      actor = { group: g, confidence: ml.threatActor?.confidence }
    }
  }

  return {
    riskScore,
    severity,
    tactics: [...tactics],
    techniques: [...techniques.values()],
    threatActor: actor,
    modelsUsed: [...models],
    enrichedCount: enriched.length,
    engine,
  }
}

/** Extra learning notes derived from the ML enrichment (kept separate from regex hints). */
export function mlHints(events: AttackEvent[]): string[] {
  const summary = summarizeMl(events)
  if (!summary) return []
  const hints: string[] = []
  if (summary.severity === 'malicious') {
    hints.push(`ML severity: malicious (risk ${summary.riskScore}/100) — confirmed high-confidence attacker.`)
  }
  if (summary.tactics.length >= 2) {
    hints.push(`ML maps this session across ${summary.tactics.length} ATT&CK tactics: ${summary.tactics.join(' → ')}.`)
  }
  if (summary.threatActor) {
    const conf = summary.threatActor.confidence != null ? ` (${Math.round(summary.threatActor.confidence * 100)}%)` : ''
    hints.push(`Possible threat-actor profile: ${summary.threatActor.group}${conf} — corroborate before acting.`)
  }
  return hints
}

export function deltaMs(prev: string, curr: string): string | null {
  const a = new Date(prev).getTime()
  const b = new Date(curr).getTime()
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null
  const d = b - a
  if (d < 1000) return `+${d}ms`
  if (d < 60_000) return `+${(d / 1000).toFixed(1)}s`
  return `+${(d / 60_000).toFixed(1)}m`
}
