'use client'

import React, { createContext, useContext, useCallback } from 'react'

interface AuthContextValue {
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

/**
 * Auth on the dashboard is established by the gateway (EJS login + JWT cookie).
 * The dashboard only needs a logout action; sign-in/OTP live in the gateway.
 */
export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const logout = useCallback(() => {
    fetch('/api/admin/logout', { method: 'POST' }).catch(() => {
      /* best-effort cookie clear before redirect */
    })
    window.location.assign('/gateway/logout')
  }, [])

  return <AuthContext.Provider value={{ logout }}>{children}</AuthContext.Provider>
}

export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
