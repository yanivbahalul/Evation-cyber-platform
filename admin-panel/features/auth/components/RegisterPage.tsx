'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Shield, Lock, User, Eye, EyeOff, AlertCircle, Loader2 } from 'lucide-react'

const isValidUsername = (value: string) => /^[a-zA-Z0-9._-]{3,64}$/.test(value)

const RegisterPage = () => {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [otp, setOtp] = useState('')
  const [qr, setQr] = useState<null | { qrDataUrl: string; secret: string }>(null)
  const [readyForOtp, setReadyForOtp] = useState(false)
  const [phase, setPhase] = useState<'register' | 'otp' | 'done'>('register')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    if (phase !== 'register') return

    const trimmedUsername = username.trim()
    if (!isValidUsername(trimmedUsername)) {
      setError('Username must be 3–64 chars (letters, numbers, ., _, -)')
      return
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }

    setIsLoading(true)
    try {
      const res = await fetch('/api/admin/register', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ username: trimmedUsername, password }),
      })
      const json = (await res.json().catch(() => null)) as
        | { success: true; data?: { qrDataUrl: string; secret: string } }
        | { success: false; error?: string }
        | null

      if (!res.ok || !json || (json as any).success !== true) {
        setError((json as any)?.error || 'Registration failed')
        return
      }

      const data = (json as any).data
      if (data?.qrDataUrl && data?.secret) {
        setQr({ qrDataUrl: data.qrDataUrl, secret: data.secret })
        setReadyForOtp(true)
        setPhase('otp')
        setSuccess('Scan the QR and verify OTP to create the account.')
      } else {
        setSuccess('Scan the QR and verify OTP to create the account.')
      }
      setPassword('')
    } catch {
      setError('Network error. Please retry.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleVerify = async () => {
    setError(null)
    setSuccess(null)
    if (phase !== 'otp') return
    if (!/^\d{6}$/.test(otp)) {
      setError('OTP must be 6 digits')
      return
    }
    setIsLoading(true)
    try {
      const res = await fetch('/api/admin/register/verify-otp', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ otp }),
      })
      const json = (await res.json().catch(() => null)) as any
      if (!res.ok || !json?.success) {
        setError(json?.error || 'OTP verification failed')
        return
      }
      setSuccess('Account created and 2FA enabled. Wait for an admin to grant permissions (role=admin).')
      setOtp('')
      setReadyForOtp(false)
      setPhase('done')
    } catch {
      setError('Network error. Please retry.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div
        className="fixed inset-0 pointer-events-none opacity-5"
        style={{
          backgroundImage:
            'linear-gradient(#0d9488 1px, transparent 1px), linear-gradient(90deg, #0d9488 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />

      <div className="relative w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-surface border border-primary/30 mb-4 pulse-teal">
            <Shield className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-xl font-bold text-foreground tracking-tight">InnoTech HoneyNet</h1>
          <p className="text-muted-foreground text-sm mt-1">Create admin account</p>
        </div>

        <div className="bg-surface border border-border rounded-xl p-6 shadow-2xl">
          {(error || success) && (
            <div
              className={`flex items-center gap-2 rounded-lg px-3 py-2 mb-4 text-sm border ${
                error
                  ? 'bg-danger/10 border-danger/30 text-danger'
                  : 'bg-primary/10 border-primary/30 text-foreground'
              }`}
            >
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error || success}</span>
            </div>
          )}

          <form onSubmit={handleRegister} className="flex flex-col gap-4">
            {phase === 'register' && (
              <>
            <div>
              <label className="block text-xs font-mono text-muted-foreground mb-1.5 uppercase tracking-wider">
                Username
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  autoComplete="username"
                  required
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  placeholder="admin"
                  className="w-full bg-background border border-border rounded-lg pl-9 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 font-mono focus:outline-none focus:border-primary transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-mono text-muted-foreground mb-1.5 uppercase tracking-wider">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-background border border-border rounded-lg pl-9 pr-10 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 font-mono focus:outline-none focus:border-primary transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="flex items-center justify-center gap-2 w-full bg-primary hover:bg-primary-hover disabled:opacity-60 text-primary-foreground rounded-lg py-2.5 text-sm font-semibold transition-colors mt-1"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Creating...
                </>
              ) : (
                'Create account'
              )}
            </button>
              </>
            )}

            {qr && (
              <div className="bg-background/40 border border-border rounded-lg p-3 flex flex-col items-center gap-2">
                <img src={qr.qrDataUrl} alt="2FA QR code" className="w-44 h-44 rounded" />
                <div className="w-full text-[11px] font-mono text-muted-foreground break-all text-center">
                  Secret (manual entry): <span className="text-foreground">{qr.secret}</span>
                </div>

                <div className="w-full flex flex-col gap-2 mt-2">
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]{6}"
                    maxLength={6}
                    required
                    value={otp}
                    onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
                    placeholder="123456"
                    className="w-full bg-background border border-border rounded-lg px-4 py-2.5 text-center text-lg tracking-[0.4em] text-foreground font-mono focus:outline-none focus:border-accent transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => handleVerify()}
                    disabled={!readyForOtp || isLoading || otp.length !== 6}
                    className="flex items-center justify-center gap-2 w-full bg-accent hover:bg-accent-hover disabled:opacity-60 text-accent-foreground rounded-lg py-2.5 text-sm font-semibold transition-colors"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" /> Verifying...
                      </>
                    ) : (
                      'Verify OTP (create account)'
                    )}
                  </button>
                </div>
              </div>
            )}

            <div className="text-xs font-mono text-muted-foreground text-center">
              {phase === 'done' ? (
                <Link href="/login" className="text-primary hover:underline underline-offset-4">
                  Return to login
                </Link>
              ) : (
                <>
                  Already have an account?{' '}
                  <Link href="/login" className="text-primary hover:underline underline-offset-4">
                    Login
                  </Link>
                </>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

export default RegisterPage
