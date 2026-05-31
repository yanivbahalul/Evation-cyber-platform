'use client'

import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
  useMemo,
} from 'react'
import { io, type Socket } from 'socket.io-client'
import type {
  AttackEvent,
  AttackerProfile,
  AttackerTimeline,
  HoneyToken,
  LiveAlert,
} from '@/lib/types/telemetry'
import {
  readDashboardCache,
  writeDashboardCache,
  type DashboardSnapshot,
} from '@/lib/dashboardCache'
import { randomEventId, mapSocketLiveAlert } from './liveAlertMapper'
import { mergeEventGeo } from '@/lib/geoDisplay'
import {
  MOCK_PROFILES,
  MOCK_EVENTS,
  MOCK_TOKENS,
  LIVE_TEMPLATES,
} from './demoFixtures'

export type { AttackEvent, AttackerProfile, HoneyToken, LiveAlert, TrapType } from '@/lib/types/telemetry'

interface SocketContextValue {
  connected: boolean
  demoMode: boolean
  setDemoMode: (enabled: boolean) => void
  liveAlerts: LiveAlert[]
  attackEvents: AttackEvent[]
  attackerProfiles: AttackerProfile[]
  honeyTokens: HoneyToken[]
  /**
   * The canonical list used by BOTH the map and the bottom feed.
   * - ordered newest → oldest
   * - de-duped by eventID
   * - liveAlerts first (realtime), then attackEvents (polled)
   * - enriched with profile geo/os when coming from attackEvents
   */
  displayAlerts: Array<{
    eventID: string
    attackerIp: string
    trapType: string
    timestamp: string
    city: string
    country?: string
    lat: number
    lng: number
    geoPrecision?: string
    os: string
    riskScore?: number
    wastedTimeMs: number
    traceId?: string
    path?: string
    payload?: string
  }>
  /** Timestamp (ms) when the UI was last "cleared". */
  clearedAtMs: number
  dataStale: boolean
  /** True while a background refresh is in flight (UI can show cached data meanwhile). */
  isSyncing: boolean
  /** True once we have events/profiles/tokens from cache or a successful fetch. */
  hasDashboardData: boolean
  lastRefreshError: string | null
  getTimelineForIp: (ip: string, traceId?: string) => AttackerTimeline | null
  /** Clears realtime alerts + hides older polled events from the UI. */
  clearScreen: () => void
  refresh: () => Promise<void>
}

export type DashboardBootstrap = Omit<DashboardSnapshot, 'savedAt'>

const SocketContext = createContext<SocketContextValue | null>(null)

function applySnapshot(
  snapshot: DashboardBootstrap,
  setters: {
    setAttackEvents: (v: AttackEvent[]) => void
    setAttackerProfiles: (v: AttackerProfile[]) => void
    setHoneyTokens: (v: HoneyToken[]) => void
  },
) {
  setters.setAttackEvents(Array.isArray(snapshot.events) ? snapshot.events : [])
  setters.setAttackerProfiles(Array.isArray(snapshot.profiles) ? snapshot.profiles : [])
  setters.setHoneyTokens(Array.isArray(snapshot.honeyTokens) ? snapshot.honeyTokens : [])
}

export function SocketProvider({
  children,
  bootstrap,
}: {
  children: React.ReactNode
  bootstrap?: DashboardBootstrap | null
}) {
  const [connected, setConnected] = useState(false)
  const [demoMode, setDemoModeState] = useState(false)
  const [liveAlerts, setLiveAlerts] = useState<LiveAlert[]>([])
  const [attackEvents, setAttackEvents] = useState<AttackEvent[]>([])
  const [attackerProfiles, setAttackerProfiles] = useState<AttackerProfile[]>([])
  const [honeyTokens, setHoneyTokens] = useState<HoneyToken[]>([])
  const [clearedAtMs, setClearedAtMs] = useState(0)
  const [dataStale, setDataStale] = useState(false)
  const [isSyncing, setIsSyncing] = useState(true)
  const [hasDashboardData, setHasDashboardData] = useState(false)
  const [lastRefreshError, setLastRefreshError] = useState<string | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const idxRef = useRef(0)
  const socketRef = useRef<Socket | null>(null)
  const refreshGenerationRef = useRef(0)
  const refreshInFlightRef = useRef(false)
  const refreshPendingRef = useRef(false)
  const refreshAfterAlertRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const syncingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hasDashboardDataRef = useRef(false)
  const lastRefreshAtRef = useRef(0)
  const connectedRef = useRef(false)

  const setDemoMode = useCallback((enabled: boolean) => {
    refreshGenerationRef.current += 1
    if (enabled) idxRef.current = 0
    setDemoModeState(enabled)
    try {
      localStorage.setItem('demo_mode', enabled ? '1' : '0')
    } catch {
      // ignore
    }
  }, [])

  const applyDashboardPayload = useCallback((payload: DashboardBootstrap) => {
    applySnapshot(payload, { setAttackEvents, setAttackerProfiles, setHoneyTokens })
    writeDashboardCache(payload)
    setHasDashboardData(true)
    hasDashboardDataRef.current = true
    setDataStale(false)
    setLastRefreshError(null)
  }, [])

  const refresh = useCallback(async (signal?: AbortSignal) => {
    if (demoMode) return
    // Avoid UI flicker + excessive refresh storms when live alerts stream in.
    // We still allow refreshPendingRef to coalesce requests if one is in-flight.
    const now = Date.now()
    if (now - lastRefreshAtRef.current < 3_000 && !refreshInFlightRef.current) return
    if (refreshInFlightRef.current) {
      refreshPendingRef.current = true
      return
    }
    lastRefreshAtRef.current = now

    const generation = refreshGenerationRef.current
    refreshInFlightRef.current = true
    // Don't flash "SYNC" for quick background refreshes once we already have data.
    if (syncingTimerRef.current) clearTimeout(syncingTimerRef.current)
    if (!hasDashboardDataRef.current) {
      setIsSyncing(true)
    } else {
      syncingTimerRef.current = setTimeout(() => {
        syncingTimerRef.current = null
        if (refreshInFlightRef.current && generation === refreshGenerationRef.current) setIsSyncing(true)
      }, 450)
    }

    try {
      const res = await fetch('/api/admin/dashboard?limit=200', { method: 'GET', signal })

      if (signal?.aborted || generation !== refreshGenerationRef.current) return

      if (!res.ok) {
        setLastRefreshError(`HTTP ${res.status}`)
        setDataStale(true)
        return
      }

      const json = await res.json()

      if (signal?.aborted || generation !== refreshGenerationRef.current) return

      if (!json?.success || !json?.data) {
        setLastRefreshError('API returned success=false')
        setDataStale(true)
        return
      }

      const { events, profiles, honeyTokens: tokens } = json.data as DashboardBootstrap
      applyDashboardPayload({
        events: Array.isArray(events) ? events : [],
        profiles: Array.isArray(profiles) ? profiles : [],
        honeyTokens: Array.isArray(tokens) ? tokens : [],
      })
    } catch (err) {
      if (signal?.aborted || generation !== refreshGenerationRef.current) return
      const message = err instanceof Error ? err.message : String(err)
      setLastRefreshError(message)
      setDataStale(true)
    } finally {
      refreshInFlightRef.current = false
      if (syncingTimerRef.current) {
        clearTimeout(syncingTimerRef.current)
        syncingTimerRef.current = null
      }
      if (generation === refreshGenerationRef.current) setIsSyncing(false)
      if (refreshPendingRef.current) {
        refreshPendingRef.current = false
        void refresh(signal)
      }
    }
  }, [demoMode, applyDashboardPayload])

  const getTimelineForIp = useCallback(
    (ip: string, traceId?: string): AttackerTimeline | null => {
      const trimmed = ip.trim()
      if (!trimmed) return null
      const profile = attackerProfiles.find(p => p.ip === trimmed) ?? null
      let events = attackEvents.filter(e => e.attackerIp === trimmed)
      const tid = traceId?.trim()
      if (tid) {
        events = events.filter(e => !e.traceId || e.traceId === tid)
      }
      if (!profile && events.length === 0) return null
      events = [...events].sort(
        (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
      )
      return { profile, events }
    },
    [attackEvents, attackerProfiles],
  )

  useEffect(() => {
    if (bootstrap) {
      applyDashboardPayload(bootstrap)
      return
    }
    const cached = readDashboardCache()
    if (cached) {
      applyDashboardPayload({
        events: cached.events,
        profiles: cached.profiles,
        honeyTokens: cached.honeyTokens,
      })
    }
  }, [bootstrap, applyDashboardPayload])

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
      refreshGenerationRef.current += 1
      idxRef.current = 0
      setDataStale(false)
      setLastRefreshError(null)
      setAttackEvents(MOCK_EVENTS)
      setAttackerProfiles(MOCK_PROFILES)
      setHoneyTokens(MOCK_TOKENS)
      setHasDashboardData(true)
      setIsSyncing(false)

      const connectTimer = setTimeout(() => setConnected(true), 700)
      intervalRef.current = setInterval(() => {
        const tmpl = LIVE_TEMPLATES[idxRef.current % LIVE_TEMPLATES.length]
        idxRef.current++
        const alert: LiveAlert = {
          ...tmpl,
          eventID: randomEventId(),
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

    // nginx proxies /socket.io/ on the same host:port as the dashboard.
    // A baked-in LAN IP breaks localhost, ngrok HTTPS, and mixed-content rules.
    const socketUrl = window.location.origin
    const envToken = process.env.NEXT_PUBLIC_ADMIN_SOCKET_TOKEN
    const isProd = process.env.NODE_ENV === 'production'
    const token = envToken || (isProd ? '' : 'admin-secret')

    if (isProd && !envToken) {
      setLastRefreshError('NEXT_PUBLIC_ADMIN_SOCKET_TOKEN is not configured')
      setDataStale(true)
    }

    const abort = new AbortController()
    refreshGenerationRef.current += 1

    const restartPoll = () => {
      if (pollRef.current) clearInterval(pollRef.current)
      const ms = connectedRef.current ? 15_000 : 5_000
      pollRef.current = setInterval(() => {
        if (document.visibilityState === 'visible') {
          refresh(abort.signal).catch(() => {})
        }
      }, ms)
    }

    let sock: Socket | null = null
    if (token) {
      sock = io(socketUrl, {
        auth: { token },
        transports: ['websocket', 'polling'],
        reconnection: true,
      })
      socketRef.current = sock

      sock.on('connect', () => {
        connectedRef.current = true
        setConnected(true)
        restartPoll()
      })
      sock.on('disconnect', () => {
        connectedRef.current = false
        setConnected(false)
        restartPoll()
      })
      sock.on('connect_error', (err: Error) => {
        connectedRef.current = false
        setConnected(false)
        restartPoll()
        if (process.env.NODE_ENV === 'development') {
          console.warn('[admin socket] connect_error →', socketUrl, err?.message || err)
        }
      })

      sock.on('liveAlert', (data: Record<string, unknown>) => {
        const alert = mapSocketLiveAlert(data)
        setLiveAlerts(prev => [alert, ...prev].slice(0, 200))
        if (refreshAfterAlertRef.current) clearTimeout(refreshAfterAlertRef.current)
        refreshAfterAlertRef.current = setTimeout(() => {
          refreshAfterAlertRef.current = null
          // Bypass the 3s coalesce window so polled attackEvents catch up quickly.
          lastRefreshAtRef.current = 0
          refresh(abort.signal).catch(() => {})
        }, 300)
      })
    }

    refresh(abort.signal).catch(() => {})
    restartPoll()

    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh(abort.signal).catch(() => {})
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      abort.abort()
      document.removeEventListener('visibilitychange', onVisible)
      if (refreshAfterAlertRef.current) clearTimeout(refreshAfterAlertRef.current)
      if (syncingTimerRef.current) clearTimeout(syncingTimerRef.current)
      refreshGenerationRef.current += 1
      if (intervalRef.current) clearInterval(intervalRef.current)
      if (pollRef.current) clearInterval(pollRef.current)
      if (socketRef.current) {
        socketRef.current.disconnect()
        socketRef.current = null
      }
      if (sock) {
        sock.off('connect')
        sock.off('disconnect')
        sock.off('connect_error')
        sock.off('liveAlert')
      }
    }
  }, [demoMode, refresh])

  const clearScreen = useCallback(() => {
    setClearedAtMs(Date.now())
    setLiveAlerts([])
  }, [])

  const displayAlerts = useMemo(() => {
    const seen = new Set<string>()
    const out: SocketContextValue['displayAlerts'] = []

    const profileByIp = new Map(attackerProfiles.map(p => [p.ip, p]))

    const accept = (timestamp: string) => {
      const ts = new Date(timestamp).getTime()
      return Number.isFinite(ts) ? ts >= clearedAtMs : true
    }

    for (const a of liveAlerts) {
      if (!a?.eventID || seen.has(a.eventID)) continue
      if (!accept(a.timestamp)) continue
      seen.add(a.eventID)
      const p = profileByIp.get(a.attackerIp)
      const geo = mergeEventGeo(a, p)
      out.push({
        eventID: a.eventID,
        attackerIp: a.attackerIp,
        trapType: a.trapType,
        timestamp: a.timestamp,
        city: geo.city,
        country: geo.country,
        lat: geo.lat,
        lng: geo.lng,
        geoPrecision: geo.geoPrecision,
        os: a.os,
        riskScore: a.riskScore ?? p?.riskScore,
        wastedTimeMs: a.wastedTimeMs ?? a.wasted_time_ms ?? 0,
        traceId: a.traceId,
        path: a.path,
        payload: a.payload,
      })
      if (out.length >= 50) return out
    }

    for (const e of attackEvents) {
      if (!e?.eventID || seen.has(e.eventID)) continue
      if (!accept(e.timestamp)) continue
      seen.add(e.eventID)
      const p = profileByIp.get(e.attackerIp)
      const geo = mergeEventGeo({}, p)
      out.push({
        eventID: e.eventID,
        attackerIp: e.attackerIp,
        trapType: e.trapType,
        timestamp: e.timestamp,
        city: geo.city,
        country: geo.country,
        lat: geo.lat,
        lng: geo.lng,
        geoPrecision: geo.geoPrecision,
        os: p?.os ?? 'unknown',
        riskScore: p?.riskScore,
        wastedTimeMs: e.wasted_time_ms ?? 0,
        traceId: e.traceId,
        path: e.path,
        payload: e.payload,
      })
      if (out.length >= 50) break
    }

    return out
  }, [attackEvents, attackerProfiles, clearedAtMs, liveAlerts])

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
        displayAlerts,
        clearedAtMs,
        dataStale,
        isSyncing,
        hasDashboardData,
        lastRefreshError,
        getTimelineForIp,
        clearScreen,
        refresh: () => refresh(),
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
