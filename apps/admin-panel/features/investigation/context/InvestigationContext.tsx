'use client'

import React, { createContext, useCallback, useContext, useState } from 'react'

export interface InvestigationTarget {
  ip?: string
  traceId?: string
}

interface InvestigationContextValue {
  target: InvestigationTarget | null
  openInvestigation: (t: InvestigationTarget) => void
  clearInvestigation: () => void
}

const InvestigationContext = createContext<InvestigationContextValue | null>(null)

export function InvestigationProvider({
  children,
  onNavigateWorkspace,
}: {
  children: React.ReactNode
  onNavigateWorkspace?: () => void
}) {
  const [target, setTarget] = useState<InvestigationTarget | null>(null)

  const openInvestigation = useCallback(
    (t: InvestigationTarget) => {
      setTarget({
        ip: t.ip?.trim() || undefined,
        traceId: t.traceId?.trim() || undefined,
      })
      onNavigateWorkspace?.()
    },
    [onNavigateWorkspace],
  )

  const clearInvestigation = useCallback(() => setTarget(null), [])

  return (
    <InvestigationContext.Provider value={{ target, openInvestigation, clearInvestigation }}>
      {children}
    </InvestigationContext.Provider>
  )
}

export function useInvestigation() {
  const ctx = useContext(InvestigationContext)
  if (!ctx) throw new Error('useInvestigation must be used inside InvestigationProvider')
  return ctx
}
