'use client'

import { AuthProvider, useAuth } from '@/context/AuthContext'
import { SocketProvider } from '@/context/SocketContext'
import Dashboard from '@/components/dashboard/Dashboard'
import { useEffect } from 'react'
import RedirectToGatewayLogin from '@/components/RedirectToGatewayLogin'

/**
 * Root page — renders the login gate or the dashboard depending on
 * the authentication step tracked in AuthContext.
 *
 * The SocketProvider is mounted inside the authenticated branch so
 * the WebSocket connection only opens after the Blue Team operator
 * has passed 2FA verification.
 */
function AppRouter() {
  const { step, redirectTo, isCheckingSession } = useAuth()

  useEffect(() => {
    if (step !== 'authenticated') return
    if (!redirectTo?.startsWith('/gateway')) return
    // Hard navigation is required because /gateway/* is proxied to the Express gateway (not a Next route).
    window.location.assign(redirectTo)
  }, [step, redirectTo])

  if (isCheckingSession) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="bg-surface border border-border rounded-xl p-6 shadow-2xl text-center">
          <div className="text-sm font-semibold text-foreground">Checking session…</div>
          <div className="text-xs text-muted-foreground mt-1">/api/admin/session</div>
        </div>
      </div>
    )
  }

  if (step !== 'authenticated') return <RedirectToGatewayLogin />

  // If the unified login authenticated a regular user, we immediately hard-navigate
  // to the Safe Zone under /gateway/* (served by the Express gateway via rewrites).
  // Avoid flashing the Blue Team dashboard during that transition.
  if (redirectTo?.startsWith('/gateway')) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="bg-surface border border-border rounded-xl p-6 shadow-2xl text-center">
          <div className="text-sm font-semibold text-foreground">Redirecting to Safe Zone…</div>
          <div className="text-xs text-muted-foreground mt-1">{redirectTo}</div>
        </div>
      </div>
    )
  }

  return (
    <SocketProvider>
      <Dashboard />
    </SocketProvider>
  )
}

export default function Page() {
  return (
    <AuthProvider>
      <AppRouter />
    </AuthProvider>
  )
}
