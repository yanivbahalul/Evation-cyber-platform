'use client'

import { Suspense, useEffect, useState } from 'react'
import { AuthProvider } from '@/features/auth/context/AuthContext'
import {
  SocketProvider,
  type DashboardBootstrap,
} from '@/features/dashboard/context/SocketContext'
import Dashboard from '@/features/dashboard/components/Dashboard'
import { readDashboardCache, writeDashboardCache } from '@/lib/dashboardCache'

type PortalSession =
  | { authenticated: true; role: 'admin' | 'user'; sub?: string; redirectTo?: string }
  | { authenticated: false }

function snapshotFromCache(): DashboardBootstrap | null {
  const cached = readDashboardCache()
  if (!cached) return null
  return {
    events: cached.events,
    profiles: cached.profiles,
    honeyTokens: cached.honeyTokens,
  }
}

/**
 * Single dashboard URL for everyone — UI by DB role:
 * - admin → attack history (this React shell)
 * - user  → HR workspace (proxied gateway EJS)
 */
export default function GatewayDashboardPage() {
  // SSR and first client paint must match — cache is read only after mount.
  const [phase, setPhase] = useState<'loading' | 'admin' | 'redirect'>('loading')
  const [bootstrap, setBootstrap] = useState<DashboardBootstrap | null>(null)

  useEffect(() => {
    let cancelled = false

    const cached = snapshotFromCache()
    if (cached) {
      setBootstrap(cached)
      setPhase('admin')
    }

    const dashboardWarm = fetch('/api/admin/dashboard?limit=200', {
      method: 'GET',
      credentials: 'include',
    })

    ;(async () => {
      try {
        const res = await fetch('/api/portal/session', { method: 'GET', credentials: 'include' })
        const json = (await res.json().catch(() => null)) as PortalSession | null
        if (cancelled) return

        if (!json || json.authenticated !== true) {
          window.location.assign('/gateway/login/')
          return
        }

        if (json.role !== 'admin') {
          setPhase('redirect')
          const home =
            typeof json.redirectTo === 'string' ? json.redirectTo : '/gateway/workspace/'
          window.location.assign(home)
          return
        }

        setPhase('admin')

        const dashRes = await dashboardWarm
        const dashJson = await dashRes.json().catch(() => null)
        if (cancelled || !dashJson?.success || !dashJson?.data) return

        const payload: DashboardBootstrap = {
          events: dashJson.data.events ?? [],
          profiles: dashJson.data.profiles ?? [],
          honeyTokens: dashJson.data.honeyTokens ?? [],
        }
        writeDashboardCache(payload)
        setBootstrap(payload)
      } catch {
        if (!cancelled) window.location.assign('/gateway/login/')
      }
    })()

    return () => {
      cancelled = true
    }
  }, [])

  if (phase === 'redirect') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-sm text-muted-foreground">Redirecting…</div>
      </div>
    )
  }

  if (phase === 'loading') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-sm text-muted-foreground">Loading dashboard…</div>
      </div>
    )
  }

  return (
    <AuthProvider>
      <SocketProvider bootstrap={bootstrap}>
        <Suspense fallback={<div className="min-h-screen bg-background flex items-center justify-center p-4 text-sm text-muted-foreground">Loading dashboard…</div>}>
          <Dashboard />
        </Suspense>
      </SocketProvider>
    </AuthProvider>
  )
}
