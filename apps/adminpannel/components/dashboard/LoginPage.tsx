'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Shield, Lock, User, KeyRound, Eye, EyeOff, AlertCircle, Loader2 } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'

/**
 * LoginPage — unified sign-in for employees and operators.
 * Everyone lands on `/gateway/workspace/`; attack monitor is optional for DB role `admin`.
 */
export default function LoginPage() {
  const { step, error, isLoading, submitCredentials, submitOtp, redirectTo } = useAuth()
  const router = useRouter()

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [otp, setOtp] = useState('')

  useEffect(() => {
    if (step === 'authenticated') {
      const target = redirectTo || '/'
      // `/gateway/*` is served by the Express gateway via Next rewrites (not a Next route),
      // so we must do a full navigation to avoid App Router trying to fetch a flight response.
      if (target.startsWith('/gateway')) {
        window.location.assign(target)
        return
      }
      router.replace(target)
    }
  }, [step, router, redirectTo])

  const handleCredentials = (e: React.FormEvent) => {
    e.preventDefault()
    submitCredentials(username, password)
  }

  const handleOtp = (e: React.FormEvent) => {
    e.preventDefault()
    submitOtp(otp)
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      {/* Background grid */}
      <div
        className="fixed inset-0 pointer-events-none opacity-5"
        style={{
          backgroundImage:
            'linear-gradient(#0d9488 1px, transparent 1px), linear-gradient(90deg, #0d9488 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />

      <div className="relative w-full max-w-sm">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-surface border border-primary/30 mb-4 pulse-teal">
            <Shield className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-xl font-bold text-foreground tracking-tight">
            InnoTech Internal Services
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Employee sign-in — MFA required
          </p>
        </div>

        {/* Card */}
        <div className="bg-surface border border-border rounded-xl p-6 shadow-2xl">
          {/* Step indicator */}
          <div className="flex items-center gap-3 mb-6">
            <StepDot active={step === 'credentials'} done={step === 'otp' || step === 'authenticated'} label="1" />
            <div className={`flex-1 h-px transition-colors duration-500 ${step === 'otp' ? 'bg-primary' : 'bg-border'}`} />
            <StepDot active={step === 'otp'} done={step === 'authenticated'} label="2" />
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 bg-danger/10 border border-danger/30 rounded-lg px-3 py-2 mb-4 text-danger text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Step 1: Credentials */}
          {step === 'credentials' && (
            <form onSubmit={handleCredentials} className="flex flex-col gap-4">
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
                    autoComplete="current-password"
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
                  <><Loader2 className="w-4 h-4 animate-spin" /> Authenticating...</>
                ) : (
                  'Continue to 2FA'
                )}
              </button>

              <div className="text-xs font-mono text-muted-foreground text-center">
                Need an account?{' '}
                <Link href="/gateway/register" className="text-primary hover:underline underline-offset-4">
                  Register
                </Link>
              </div>
            </form>
          )}

          {/* Step 2: OTP */}
          {step === 'otp' && (
            <form onSubmit={handleOtp} className="flex flex-col gap-4">
              <div className="text-center pb-2">
                <KeyRound className="w-8 h-8 text-accent mx-auto mb-2" />
                <p className="text-sm text-foreground font-semibold">Two-Factor Authentication</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Enter the 6-digit code from your authenticator app.
                </p>
              </div>

              <div>
                <label className="block text-xs font-mono text-muted-foreground mb-1.5 uppercase tracking-wider">
                  OTP Code
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  required
                  value={otp}
                  onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
                  placeholder="123456"
                  className="w-full bg-background border border-border rounded-lg px-4 py-3 text-center text-xl tracking-[0.5em] text-foreground font-mono focus:outline-none focus:border-accent transition-colors"
                />
              </div>

              <div className="text-xs font-mono text-muted-foreground text-center">
                If you lost your authenticator device, ask an admin to reset your 2FA.
              </div>

              <button
                type="submit"
                disabled={isLoading || otp.length !== 6}
                className="flex items-center justify-center gap-2 w-full bg-accent hover:bg-accent-hover disabled:opacity-60 text-accent-foreground rounded-lg py-2.5 text-sm font-semibold transition-colors"
              >
                {isLoading ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Verifying...</>
                ) : (
                  'Verify & Enter'
                )}
              </button>
            </form>
          )}
        </div>

        {/* Footer notice */}
        <p className="text-center text-[11px] text-muted-foreground/60 mt-4 font-mono">
          UNAUTHORIZED ACCESS IS STRICTLY PROHIBITED
        </p>
        <p className="text-center text-[10px] text-muted-foreground/40 mt-1">
          Holon Institute of Technologies — InnoTech Internal Services
        </p>

        {/* Dev hint */}
        <div className="mt-4 bg-surface border border-border/50 rounded-lg p-3 text-[11px] font-mono text-muted-foreground/60">
          <span className="text-primary/70">Preview:</span> admin / blueteam &rarr; OTP: 123456
        </div>
      </div>
    </div>
  )
}

function StepDot({ active, done, label }: { active: boolean; done: boolean; label: string }) {
  return (
    <div
      className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 shrink-0 ${
        done
          ? 'bg-primary text-primary-foreground'
          : active
          ? 'bg-primary/20 border-2 border-primary text-primary'
          : 'bg-surface border border-border text-muted-foreground'
      }`}
    >
      {done ? '✓' : label}
    </div>
  )
}
