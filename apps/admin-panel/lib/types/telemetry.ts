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
}

export interface LiveAlert extends AttackEvent {
  city: string
  lat: number
  lng: number
  os: string
  browser?: string
  riskScore?: number
  wastedTimeMs: number
  bytesSent?: number
}

export interface AttackerProfile {
  ip: string
  city: string
  lat: number
  lng: number
  os: string
  platform?: string
  browser: string
  deviceType?: string
  isBot: boolean
  riskScore: number
  firstSeen: string
  lastSeen: string
  traceIds?: string[]
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
