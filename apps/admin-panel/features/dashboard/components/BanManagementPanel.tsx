'use client'

import { useCallback, useEffect, useState } from 'react'
import { Ban, Loader2, RefreshCw } from 'lucide-react'

interface BanRow {
  ip: string
  bannedAt: string | null
  bannedBy: string | null
  riskScore: number
  city: string
}

export default function BanManagementPanel() {
  const [bans, setBans] = useState<BanRow[]>([])
  const [ipInput, setIpInput] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadBans = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/ban', { credentials: 'include' })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error || 'Failed to load bans')
      setBans(json.data ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load bans')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadBans()
  }, [loadBans])

  const banIp = async (ip: string) => {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/ban', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ip }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error || 'Ban failed')
      setIpInput('')
      await loadBans()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ban failed')
    } finally {
      setBusy(false)
    }
  }

  const unbanIp = async (ip: string) => {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/ban?ip=${encodeURIComponent(ip)}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error || 'Unban failed')
      await loadBans()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unban failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-4 h-full">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[200px]">
          <label className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest block mb-1">
            Ban IP address
          </label>
          <input
            type="text"
            value={ipInput}
            onChange={(e) => setIpInput(e.target.value)}
            placeholder="203.0.113.10"
            className="w-full px-3 py-2 rounded-lg bg-surface border border-border text-sm font-mono"
          />
        </div>
        <button
          type="button"
          disabled={busy || !ipInput.trim()}
          onClick={() => banIp(ipInput.trim())}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-danger/15 text-danger border border-danger/30 text-sm font-medium hover:bg-danger/25 disabled:opacity-50"
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Ban className="w-4 h-4" />}
          Ban IP
        </button>
        <button
          type="button"
          onClick={loadBans}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {error && (
        <p className="text-xs font-mono text-danger bg-danger/10 border border-danger/30 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        <table className="w-full text-xs font-mono">
          <thead>
            <tr className="border-b border-border text-muted-foreground text-left">
              <th className="px-4 py-2">IP</th>
              <th className="px-4 py-2">City</th>
              <th className="px-4 py-2">Risk</th>
              <th className="px-4 py-2">Banned at</th>
              <th className="px-4 py-2">By</th>
              <th className="px-4 py-2 w-24" />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                  Loading bans…
                </td>
              </tr>
            ) : bans.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                  No banned IPs yet.
                </td>
              </tr>
            ) : (
              bans.map((row) => (
                <tr key={row.ip} className="border-b border-border/50 hover:bg-surface-elevated/50">
                  <td className="px-4 py-2 text-foreground font-bold">{row.ip}</td>
                  <td className="px-4 py-2">{row.city}</td>
                  <td className="px-4 py-2">{row.riskScore}</td>
                  <td className="px-4 py-2 text-muted-foreground">
                    {row.bannedAt ? new Date(row.bannedAt).toLocaleString() : '—'}
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">{row.bannedBy || '—'}</td>
                  <td className="px-4 py-2">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => unbanIp(row.ip)}
                      className="text-success hover:underline disabled:opacity-50"
                    >
                      Unban
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
