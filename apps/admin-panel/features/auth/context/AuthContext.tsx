'use client'

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react'

export type AuthStep = 'credentials' | 'otp' | 'authenticated'

interface AuthState {
  step: AuthStep
  username: string | null
  redirectTo?: string | null
  error: string | null
  isLoading: boolean
  isCheckingSession: boolean
  /** Valid session on login page — do not auto-redirect; user picks continue or sign out. */
  existingSession: { sub: string; redirectTo: string } | null
}

interface AuthContextValue extends AuthState {
  submitCredentials: (username: string, password: string) => Promise<void>
  submitOtp: (otp: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

/**
 * AuthProvider — manages the 2-step authentication flow.
 * Step 1: username + password  →  Step 2: TOTP / OTP code
 * JWT is issued as HttpOnly cookie by the server (never stored in JS).
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    step: 'credentials',
    username: null,
    error: null,
    isLoading: false,
    isCheckingSession: true,
    existingSession: null,
  })

  const onLoginPage =
    typeof window !== 'undefined' && /\/gateway\/login\/?$/.test(window.location.pathname)

  // Restore session on protected pages; on /gateway/login show "already signed in" instead of auto-redirect.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/portal/session', { method: 'GET', credentials: 'include' })
        const json = (await res.json().catch(() => null)) as
          | { authenticated: true; sub?: string; redirectTo?: string }
          | { authenticated: false }
          | null
        if (cancelled) return
        if (json && (json as { authenticated?: boolean }).authenticated === true) {
          const sub = (json as { sub?: string }).sub || ''
          const redirectTo =
            (json as { redirectTo?: string }).redirectTo || '/gateway/workspace/'
          if (onLoginPage) {
            setState(s => ({
              ...s,
              existingSession: sub ? { sub, redirectTo } : null,
              isCheckingSession: false,
            }))
            return
          }
          setState(s => ({
            ...s,
            step: 'authenticated',
            redirectTo,
            username: sub || s.username,
            error: null,
            isLoading: false,
            isCheckingSession: false,
            existingSession: null,
          }))
          return
        }
      } catch {
        // Ignore: keep credentials step
      }
      if (!cancelled) setState(s => ({ ...s, isCheckingSession: false, existingSession: null }))
    })()
    return () => {
      cancelled = true
    }
  }, [onLoginPage])

  /**
   * Step 1 — POST /api/admin/login
   * Server validates credentials and, if correct, sets a short-lived
   * session marker so the OTP step can be reached.
   */
  const submitCredentials = useCallback(
    async (username: string, password: string) => {
      setState(s => ({ ...s, isLoading: true, error: null }))
      try {
        const res = await fetch('/api/admin/login', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ username, password }),
        })
        const json = (await res.json().catch(() => null)) as
          | { success: true }
          | { success: false; error?: string }
          | null

        if (!res.ok || !json || (json as any).success !== true) {
          const msg = (json as any)?.error || 'Invalid credentials. Access denied.'
          setState(s => ({ ...s, error: msg, isLoading: false }))
          return
        }

        setState(s => ({ ...s, step: 'otp', username, error: null, isLoading: false, isCheckingSession: false }))
      } catch {
        setState(s => ({
          ...s,
          error: 'Network error. Please retry.',
          isLoading: false,
          isCheckingSession: false,
        }))
      }
    },
    []
  )

  /**
   * Step 2 — POST /api/admin/verify-otp
   * Server validates OTP, generates JWT, sets HttpOnly Secure SameSite=Strict cookie.
   */
  const submitOtp = useCallback(async (otp: string) => {
    setState(s => ({ ...s, isLoading: true, error: null }))
    try {
      const res = await fetch('/api/admin/verify-otp', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ otp }),
      })
      const json = (await res.json().catch(() => null)) as
        | { success: true; redirectTo?: string }
        | { success: false; error?: string }
        | null

      if (!res.ok || !json || (json as any).success !== true) {
        const msg = (json as any)?.error || 'Invalid OTP token. Please try again.'
        setState(s => ({ ...s, error: msg, isLoading: false }))
        return
      }

      setState(s => ({
        ...s,
        step: 'authenticated',
        redirectTo: (json as any)?.redirectTo || '/gateway/workspace/',
        isLoading: false,
        isCheckingSession: false,
      }))
    } catch {
      setState(s => ({ ...s, error: 'Network error. Please retry.', isLoading: false, isCheckingSession: false }))
    }
  }, [])

  const logout = useCallback(() => {
    fetch('/api/admin/logout', { method: 'POST' }).catch(() => {})
    setState({
      step: 'credentials',
      username: null,
      redirectTo: null,
      error: null,
      isLoading: false,
      isCheckingSession: false,
      existingSession: null,
    })
    window.location.assign('/gateway/')
  }, [])

  return (
    <AuthContext.Provider
      value={{ ...state, submitCredentials, submitOtp, logout }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
