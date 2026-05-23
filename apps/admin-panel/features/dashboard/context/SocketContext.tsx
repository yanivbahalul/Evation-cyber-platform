'use client'

import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
} from 'react'
import { io, type Socket } from 'socket.io-client'
import type { AttackEvent, AttackerProfile, LiveAlert, TrapType } from '@/lib/types/telemetry'
import { normalizeTrapType } from '@/lib/attackIntel'

export type { AttackEvent, AttackerProfile, LiveAlert, TrapType } from '@/lib/types/telemetry'

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

function mapSocketLiveAlert(data: Record<string, unknown>): LiveAlert {
  const eventID = typeof data.eventID === 'string' ? data.eventID : crypto.randomUUID()
  const trapType = normalizeTrapType(String(data.trapType ?? 'DATA_BOMB'))
  const fingerprint = (data.fingerprint as LiveAlert['fingerprint']) ?? {}
  const ts =
    typeof data.timestamp === 'string'
      ? data.timestamp
      : typeof data.timestamp === 'number'
        ? new Date(data.timestamp).toISOString()
        : new Date().toISOString()

  return {
    eventID,
    trapType,
    attackerIp: String(data.attackerIp ?? 'unknown'),
    city: String(data.city ?? 'Unknown'),
    lat: Number.isFinite(data.lat) ? Number(data.lat) : 0,
    lng: Number.isFinite(data.lng) ? Number(data.lng) : 0,
    os: String(fingerprint?.os ?? data.os ?? 'unknown'),
    browser: String(fingerprint?.browserVersion ?? fingerprint?.browser ?? data.browser ?? 'unknown'),
    riskScore: Number.isFinite(fingerprint?.riskScore) ? Number(fingerprint.riskScore) : undefined,
    wastedTimeMs: Number.isFinite(data.wasted_time_ms)
      ? Number(data.wasted_time_ms)
      : Number.isFinite(data.wastedTimeMs)
        ? Number(data.wastedTimeMs)
        : 0,
    wasted_time_ms: Number.isFinite(data.wasted_time_ms)
      ? Number(data.wasted_time_ms)
      : Number.isFinite(data.wastedTimeMs)
        ? Number(data.wastedTimeMs)
        : 0,
    bytesSent: Number.isFinite(data.bytes_sent)
      ? Number(data.bytes_sent)
      : Number.isFinite(data.bytesSent)
        ? Number(data.bytesSent)
        : undefined,
    bytes_sent: Number.isFinite(data.bytes_sent)
      ? Number(data.bytes_sent)
      : Number.isFinite(data.bytesSent)
        ? Number(data.bytesSent)
        : 0,
    timestamp: ts,
    payload: typeof data.payload === 'string' ? data.payload : undefined,
    traceId: typeof data.traceId === 'string' ? data.traceId : undefined,
    method: typeof data.method === 'string' ? data.method : undefined,
    path: typeof data.path === 'string' ? data.path : undefined,
    userAgent: typeof data.userAgent === 'string' ? data.userAgent : undefined,
    referer: typeof data.referer === 'string' ? data.referer : undefined,
    fingerprint: Object.keys(fingerprint).length ? fingerprint : undefined,
    handoffFrom: typeof data.handoffFrom === 'string' ? data.handoffFrom : undefined,
    xssTier: typeof data.xssTier === 'string' ? data.xssTier : undefined,
    secondaryTraps: Array.isArray(data.secondaryTraps) ? data.secondaryTraps.map(String) : undefined,
  }
}

interface SocketContextValue {
  connected: boolean
  demoMode: boolean
  setDemoMode: (enabled: boolean) => void
  liveAlerts: LiveAlert[]
  attackEvents: AttackEvent[]
  attackerProfiles: AttackerProfile[]
  honeyTokens: HoneyToken[]
  clearAlerts: () => void
  refresh: () => Promise<void>
}

const SocketContext = createContext<SocketContextValue | null>(null)

const MOCK_TRACE = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'

const MOCK_PROFILES: AttackerProfile[] = [
  {
    ip: '45.155.205.10',
    city: 'Moscow',
    lat: 55.7558,
    lng: 37.6173,
    os: 'Linux',
    platform: 'x86_64',
    browser: 'curl/7.85',
    deviceType: 'server',
    isBot: true,
    riskScore: 92,
    firstSeen: '2024-05-01T10:22:00Z',
    lastSeen: '2024-05-07T18:44:00Z',
    traceIds: [MOCK_TRACE],
  },
  {
    ip: '103.27.108.40',
    city: 'Beijing',
    lat: 39.9042,
    lng: 116.4074,
    os: 'Windows 11',
    platform: 'Win32',
    browser: 'Chrome/124',
    deviceType: 'desktop',
    isBot: false,
    riskScore: 78,
    firstSeen: '2024-05-03T08:10:00Z',
    lastSeen: '2024-05-07T20:01:00Z',
    traceIds: [],
  },
  {
    ip: '185.220.101.5',
    city: 'Frankfurt',
    lat: 50.1109,
    lng: 8.6821,
    os: 'Kali Linux',
    platform: 'x86_64',
    browser: 'Nmap',
    deviceType: 'server',
    isBot: true,
    riskScore: 99,
    firstSeen: '2024-05-05T02:30:00Z',
    lastSeen: '2024-05-07T22:15:00Z',
    traceIds: [MOCK_TRACE, 'trace-sql-chain-02'],
  },
  {
    ip: '1.2.3.4',
    city: 'Tel Aviv',
    lat: 32.0853,
    lng: 34.7818,
    os: 'Windows 11',
    platform: 'Win32',
    browser: 'Firefox/125',
    deviceType: 'desktop',
    isBot: false,
    riskScore: 65,
    firstSeen: '2024-05-06T14:00:00Z',
    lastSeen: '2024-05-07T23:55:00Z',
    traceIds: [],
  },
]

const MOCK_EVENTS: AttackEvent[] = [
  {
    eventID: 'e1a2b3c4',
    attackerIp: '185.220.101.5',
    trapType: 'SQL_INJECTION',
    payload: JSON.stringify({ handoff: 'sqli_bypass_illusion', username: 'admin' }),
    wasted_time_ms: 3200,
    bytes_sent: 412,
    timestamp: '2024-05-07T22:15:03Z',
    traceId: MOCK_TRACE,
    method: 'POST',
    path: '/gateway/login',
    userAgent: 'sqlmap/1.7',
    fingerprint: { os: 'Linux', isBot: true, riskScore: 50 },
    handoffFrom: 'employee_login',
  },
  {
    eventID: 'e2b3c4d5',
    attackerIp: '45.155.205.10',
    trapType: 'BRUTE_FORCE',
    payload: JSON.stringify({ handoff: 'breach_illusion', username: 'admin' }),
    wasted_time_ms: 15000,
    bytes_sent: 1024,
    timestamp: '2024-05-07T20:44:10Z',
    traceId: MOCK_TRACE,
    method: 'POST',
    path: '/gateway/login',
    handoffFrom: 'employee_login',
  },
  {
    eventID: 'e3c4d5e6',
    attackerIp: '103.27.108.40',
    trapType: 'DATA_BOMB',
    payload: '/internal/exports/archive?download=backup.zip',
    wasted_time_ms: 12500,
    bytes_sent: 8192,
    timestamp: '2024-05-07T20:01:22Z',
    path: '/internal/exports/archive',
  },
  {
    eventID: 'e4d5e6f7',
    attackerIp: '1.2.3.4',
    trapType: 'HONEY_TOKEN',
    payload: 'fake_admin:s3cr3t',
    wasted_time_ms: 2100,
    bytes_sent: 256,
    timestamp: '2024-05-07T23:55:01Z',
  },
  {
    eventID: 'e5e6f7a8',
    attackerIp: '185.220.101.5',
    trapType: 'PATH_TRAVERSAL',
    payload: JSON.stringify({ file: '../../../etc/shadow' }),
    wasted_time_ms: 900,
    bytes_sent: 128,
    timestamp: '2024-05-07T22:20:44Z',
    traceId: 'trace-sql-chain-02',
    path: '/internal/services/files',
  },
  {
    eventID: 'e6f7a8b9',
    attackerIp: '45.155.205.10',
    trapType: 'XSS_PROBE',
    payload: '<script>alert(1)</script>',
    wasted_time_ms: 500,
    bytes_sent: 64,
    timestamp: '2024-05-07T18:44:55Z',
    xssTier: 'probe',
  },
]

const MOCK_TOKENS: HoneyToken[] = [
  {
    _id: 'ht1',
    fakeUsername: 'fake_admin',
    fakePassword: 's3cr3t_bait',
    isTriggered: true,
    triggeredLogs: [
      { attackerIp: '1.2.3.4', timestamp: '2024-05-07T23:55:01Z', networkContext: 'HTTP' },
      { attackerIp: '45.155.205.10', timestamp: '2024-05-07T18:30:00Z', networkContext: 'SSH' },
    ],
  },
  {
    _id: 'ht2',
    fakeUsername: 'db_backup_user',
    fakePassword: 'backup_2024!',
    isTriggered: false,
    triggeredLogs: [],
  },
  {
    _id: 'ht3',
    fakeUsername: 'svc_monitor',
    fakePassword: 'monitor_pass',
    isTriggered: true,
    triggeredLogs: [
      { attackerIp: '185.220.101.5', timestamp: '2024-05-07T22:05:00Z', networkContext: 'SMTP' },
    ],
  },
]

const LIVE_TEMPLATES: Omit<LiveAlert, 'eventID' | 'timestamp'>[] = [
  {
    trapType: 'DATA_BOMB',
    attackerIp: '1.2.3.4',
    city: 'Tel Aviv',
    lat: 32.0853,
    lng: 34.7818,
    os: 'Windows 11',
    browser: 'Firefox/125',
    riskScore: 65,
    wastedTimeMs: 12500,
    wasted_time_ms: 12500,
    bytesSent: 8192,
    bytes_sent: 8192,
    path: '/internal/exports/archive',
    traceId: MOCK_TRACE,
  },
  {
    trapType: 'SQL_INJECTION',
    attackerIp: '185.220.101.5',
    city: 'Frankfurt',
    lat: 50.1109,
    lng: 8.6821,
    os: 'Kali Linux',
    browser: 'Nmap',
    riskScore: 99,
    wastedTimeMs: 3200,
    wasted_time_ms: 3200,
    bytesSent: 412,
    bytes_sent: 412,
    payload: "' OR 1=1 --",
    path: '/gateway/login',
    traceId: MOCK_TRACE,
  },
  {
    trapType: 'BRUTE_FORCE',
    attackerIp: '45.155.205.10',
    city: 'Moscow',
    lat: 55.7558,
    lng: 37.6173,
    os: 'Linux',
    browser: 'curl/7.85',
    riskScore: 92,
    wastedTimeMs: 15000,
    wasted_time_ms: 15000,
    bytesSent: 1024,
    bytes_sent: 1024,
    handoffFrom: 'employee_login',
    traceId: MOCK_TRACE,
  },
  {
    trapType: 'HONEY_TOKEN',
    attackerIp: '103.27.108.40',
    city: 'Beijing',
    lat: 39.9042,
    lng: 116.4074,
    os: 'Windows 11',
    browser: 'Chrome/124',
    riskScore: 78,
    wastedTimeMs: 2100,
    wasted_time_ms: 2100,
    bytesSent: 256,
    bytes_sent: 256,
  },
  {
    trapType: 'PATH_TRAVERSAL',
    attackerIp: '91.108.56.200',
    city: 'Bucharest',
    lat: 44.4268,
    lng: 26.1025,
    os: 'Ubuntu 22',
    browser: 'Wget/1.21',
    riskScore: 85,
    wastedTimeMs: 900,
    wasted_time_ms: 900,
    bytesSent: 128,
    bytes_sent: 128,
    payload: '../../../etc/shadow',
    path: '/internal/services/files',
  },
  {
    trapType: 'XSS_PROBE',
    attackerIp: '77.88.5.5',
    city: 'St. Petersburg',
    lat: 59.9343,
    lng: 30.3351,
    os: 'Windows 10',
    browser: 'Edge/124',
    riskScore: 55,
    wastedTimeMs: 500,
    wasted_time_ms: 500,
    bytesSent: 64,
    bytes_sent: 64,
    payload: '<script>alert(1)</script>',
    path: '/gateway/contact',
    xssTier: 'probe',
  },
]

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const [connected, setConnected] = useState(false)
  const [demoMode, setDemoModeState] = useState(false)
  const [liveAlerts, setLiveAlerts] = useState<LiveAlert[]>([])
  const [attackEvents, setAttackEvents] = useState<AttackEvent[]>([])
  const [attackerProfiles, setAttackerProfiles] = useState<AttackerProfile[]>([])
  const [honeyTokens, setHoneyTokens] = useState<HoneyToken[]>([])
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const idxRef = useRef(0)
  const socketRef = useRef<Socket | null>(null)

  const setDemoMode = useCallback((enabled: boolean) => {
    setDemoModeState(enabled)
    try {
      localStorage.setItem('demo_mode', enabled ? '1' : '0')
    } catch {
      // ignore
    }
  }, [])

  const refresh = useCallback(async () => {
    if (demoMode) return
    const [eventsRes, attackersRes, tokensRes] = await Promise.all([
      fetch('/api/admin/events?limit=200', { method: 'GET' }),
      fetch('/api/admin/attackers', { method: 'GET' }),
      fetch('/api/admin/honeytokens', { method: 'GET' }),
    ])

    if (!eventsRes.ok || !attackersRes.ok || !tokensRes.ok) {
      return
    }

    const [eventsJson, attackersJson, tokensJson] = await Promise.all([
      eventsRes.json(),
      attackersRes.json(),
      tokensRes.json(),
    ])

    if (!eventsJson?.success || !attackersJson?.success || !tokensJson?.success) {
      return
    }

    setAttackEvents(eventsJson.data ?? [])
    setAttackerProfiles(attackersJson.data ?? [])
    setHoneyTokens(tokensJson.data ?? [])
  }, [demoMode])

  useEffect(() => {
    try {
      const stored = localStorage.getItem('demo_mode')
      if (stored === '1') setDemoModeState(true)
    } catch {
      // ignore
    }
  }, [])

  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current)
    if (pollRef.current) clearInterval(pollRef.current)
    intervalRef.current = null
    pollRef.current = null
    if (socketRef.current) {
      socketRef.current.disconnect()
      socketRef.current = null
    }

    setLiveAlerts([])

    if (demoMode) {
      setAttackEvents(MOCK_EVENTS)
      setAttackerProfiles(MOCK_PROFILES)
      setHoneyTokens(MOCK_TOKENS)

      const connectTimer = setTimeout(() => setConnected(true), 700)
      intervalRef.current = setInterval(() => {
        const tmpl = LIVE_TEMPLATES[idxRef.current % LIVE_TEMPLATES.length]
        idxRef.current++
        const alert: LiveAlert = {
          ...tmpl,
          eventID: crypto.randomUUID(),
          timestamp: new Date().toISOString(),
        }
        setLiveAlerts(prev => [alert, ...prev].slice(0, 50))
      }, 4500)

      return () => {
        clearTimeout(connectTimer)
        if (intervalRef.current) clearInterval(intervalRef.current)
      }
    }

    setConnected(false)

    const socketUrl =
      process.env.NEXT_PUBLIC_TELEMETRY_SOCKET_URL || 'http://localhost:3002'
    const token = process.env.NEXT_PUBLIC_ADMIN_SOCKET_TOKEN || 'admin-secret'

    const sock = io(socketUrl, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
    })
    socketRef.current = sock

    sock.on('connect', () => setConnected(true))
    sock.on('disconnect', () => setConnected(false))
    sock.on('connect_error', (err: Error) => {
      setConnected(false)
      if (process.env.NODE_ENV === 'development') {
        console.warn('[admin socket] connect_error →', socketUrl, err?.message || err)
      }
    })

    sock.on('liveAlert', (data: Record<string, unknown>) => {
      const alert = mapSocketLiveAlert(data)
      setLiveAlerts(prev => [alert, ...prev].slice(0, 200))
    })

    refresh().catch(() => {})
    pollRef.current = setInterval(() => {
      refresh().catch(() => {})
    }, 10_000)

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
      if (pollRef.current) clearInterval(pollRef.current)
      if (socketRef.current) {
        socketRef.current.disconnect()
        socketRef.current = null
      }
    }
  }, [demoMode, refresh])

  const clearAlerts = useCallback(() => setLiveAlerts([]), [])

  return (
    <SocketContext.Provider
      value={{
        connected,
        demoMode,
        setDemoMode,
        liveAlerts,
        attackEvents,
        attackerProfiles,
        honeyTokens,
        clearAlerts,
        refresh,
      }}
    >
      {children}
    </SocketContext.Provider>
  )
}

export function useSocket() {
  const ctx = useContext(SocketContext)
  if (!ctx) throw new Error('useSocket must be used inside SocketProvider')
  return ctx
}
