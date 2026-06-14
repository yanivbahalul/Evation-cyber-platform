export type TrapType =
  | 'SQL_INJECTION'
  | 'HONEY_TOKEN'
  | 'DATA_BOMB'
  | 'PATH_TRAVERSAL'
  | 'BRUTE_FORCE'
  | 'XSS_PROBE'
  | 'RECON'
  | 'SQLI'
  | 'XSS'
  | 'SSRF'
  | 'SCANNER'

export interface AttackerFingerprint {
  os?: string
  platform?: string
  browser?: string
  browserVersion?: string
  deviceType?: string
  isBot?: boolean
  riskScore?: number
  screenResolution?: string
}

export type MlSeverity = 'benign' | 'suspicious' | 'malicious'

export interface MlTechnique {
  id: string
  name: string
  tactic: string
  score: number
}

export interface MlEnrichment {
  riskScore?: number
  severity?: MlSeverity
  engine?: 'ml' | 'heuristic' | 'hybrid'
  payload?: {
    label?: string
    attackType?: string
    confidence?: number
    model?: string
  }
  log?: {
    label?: string
    confidence?: number
    model?: string
  }
  mitre?: {
    tactic?: string
    tacticConfidence?: number
    techniques?: MlTechnique[]
    model?: string
  }
  threatActor?: {
    group?: string
    confidence?: number
    candidates?: Array<{ group: string; score: number }>
    model?: string
  }
  styleSignature?: string
  modelsUsed?: string[]
  computedAt?: string
}

export interface AttackEvent {
  eventID: string
  attackerIp: string
  trapType: TrapType
  payload?: string
  wasted_time_ms: number
  bytes_sent: number
  timestamp: string
  traceId?: string
  method?: string
  path?: string
  userAgent?: string
  referer?: string
  fingerprint?: AttackerFingerprint
  handoffFrom?: string
  xssTier?: string
  secondaryTraps?: string[]
  mlEnrichment?: MlEnrichment
}

export interface LiveAlert extends AttackEvent {
  city: string
  country?: string
  countryCode?: string
  lat: number
  lng: number
  geoSource?: string
  geoPrecision?: string
  os: string
  browser?: string
  riskScore?: number
  wastedTimeMs: number
  bytesSent?: number
}

export interface AttackerProfile {
  ip: string
  city: string
  country?: string
  countryCode?: string
  lat: number
  lng: number
  isp?: string
  geoSource?: string
  geoPrecision?: string
  os: string
  platform?: string
  browser: string
  deviceType?: string
  screenResolution?: string
  isBot: boolean
  riskScore: number
  firstSeen: string
  lastSeen: string
  traceIds?: string[]
  banned?: boolean
  bannedAt?: string
  bannedBy?: string
  mlRiskScore?: number
  mlSeverity?: MlSeverity
  mlTactics?: string[]
  mlThreatActor?: string
  mlThreatActorConfidence?: number
  mlStyleSignatures?: string[]
  mlModelsUsed?: string[]
}

export interface AttackerTimeline {
  profile: AttackerProfile | null
  events: AttackEvent[]
}

export interface HoneyToken {
  _id: string
  fakeUsername: string
  fakePassword: string
  isTriggered: boolean
  triggeredLogs: Array<{
    attackerIp: string
    timestamp: string
    networkContext: string
  }>
}
