'use client'

import { useEffect, useState } from 'react'
import { AuthProvider } from '@/context/AuthContext'
import { SocketProvider } from '@/context/SocketContext'
import Dashboard from '@/components/dashboard/Dashboard'

type PortalSession =
  | { authenticated: true; role: 'admin' | 'user'; sub?: string }
  | { authenticated: false }

/**
 * Single dashboard URL for everyone — UI by DB role:
 * - admin → attack history (this React shell)
 * - user  → HR workspace (proxied gateway EJS)
 */
export default function GatewayDashboardPage() {
  const [phase, setPhase] = useState<'loading' | 'admin' | 'redirect'>('loading')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/portal/session', { method: 'GET' })
        const json = (await res.json().catch(() => null)) as PortalSession | null
        if (cancelled) return
        if (!json || json.authenticated !== true) {
          window.location.assign('/gateway/login/')
          return
        }
        if (json.role === 'admin') {
          setPhase('admin')
          return
        }
        setPhase('redirect')
        const home =
          'redirectTo' in json && typeof json.redirectTo === 'string'
            ? json.redirectTo
            : '/gateway/workspace/'
        window.location.assign(home)
      } catch {
        if (!cancelled) window.location.assign('/gateway/login/')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  if (phase === 'loading' || phase === 'redirect') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-sm text-muted-foreground">Loading dashboard…</div>
      </div>
    )
  }

  return (
    <AuthProvider>
      <SocketProvider>
        <Dashboard />
      </SocketProvider>
    </AuthProvider>
  )
}
