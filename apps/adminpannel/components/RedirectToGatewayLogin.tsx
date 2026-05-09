'use client'

import { useEffect } from 'react'

export default function RedirectToGatewayLogin() {
  useEffect(() => {
    window.location.assign('/gateway/login')
  }, [])

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="bg-surface border border-border rounded-xl p-6 shadow-2xl text-center">
        <div className="text-sm font-semibold text-foreground">Redirecting…</div>
        <div className="text-xs text-muted-foreground mt-1">/gateway/login</div>
      </div>
    </div>
  )
}

