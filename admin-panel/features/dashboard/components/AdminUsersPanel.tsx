'use client'

import { useEffect, useMemo, useState } from 'react'

type AdminUser = {
  _id: string
  username: string
  role: 'admin' | 'user'
  isActive: boolean
  createdAt?: string
  updatedAt?: string
}

type UserRowProps = {
  user: AdminUser
  saving: boolean
  onRoleChange: (role: AdminUser['role']) => void
  onActiveChange: (isActive: boolean) => void
  onResetFa: () => void
  onSave: () => void
}

const UserRow = ({ user, saving, onRoleChange, onActiveChange, onResetFa, onSave }: UserRowProps) => (
  <tr className="border-t border-border/60">
    <td className="px-3 py-2 font-mono text-foreground">{user.username}</td>
    <td className="px-3 py-2">
      <select
        value={user.role}
        onChange={e => onRoleChange(e.target.value as AdminUser['role'])}
        className="bg-background border border-border rounded-md px-2 py-1 text-xs font-mono"
      >
        <option value="user">user</option>
        <option value="admin">admin</option>
      </select>
    </td>
    <td className="px-3 py-2">
      <input type="checkbox" checked={user.isActive} onChange={e => onActiveChange(e.target.checked)} />
    </td>
    <td className="px-3 py-2 text-right">
      <RowActions saving={saving} onResetFa={onResetFa} onSave={onSave} />
    </td>
  </tr>
)

const RowActions = ({ saving, onResetFa, onSave }: { saving: boolean; onResetFa: () => void; onSave: () => void }) => (
  <div className="flex items-center justify-end gap-2">
    <button
      onClick={onResetFa}
      disabled={saving}
      className="text-xs font-mono px-2.5 py-1 rounded-md bg-surface border border-border text-muted-foreground hover:text-foreground hover:border-border-bright transition-colors disabled:opacity-60"
      title="Reset user's 2FA secret"
    >
      Reset 2FA
    </button>
    <button
      onClick={onSave}
      disabled={saving}
      className="text-xs font-mono px-2.5 py-1 rounded-md bg-primary/15 border border-primary/25 text-primary hover:bg-primary/20 transition-colors disabled:opacity-60"
    >
      {saving ? 'Saving…' : 'Save'}
    </button>
  </div>
)

const AdminUsersPanel = () => {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [savingUser, setSavingUser] = useState<string | null>(null)
  const [resetFor, setResetFor] = useState<null | { username: string; qrDataUrl: string; secret: string }>(null)

  const sorted = useMemo(() => [...users].sort((a, b) => a.username.localeCompare(b.username)), [users])

  const refresh = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/users', { method: 'GET' })
      const json = (await res.json().catch(() => null)) as any
      if (!res.ok || !json?.success) {
        setError(json?.error || 'Failed to load users')
        return
      }
      setUsers(json.data || [])
    } catch {
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refresh().catch(() => {
      /* initial load is best-effort */
    })
  }, [])

  const updateUser = async (username: string, patch: Partial<Pick<AdminUser, 'role' | 'isActive'>>) => {
    setSavingUser(username)
    setError(null)
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ username, ...patch }),
      })
      const json = (await res.json().catch(() => null)) as any
      if (!res.ok || !json?.success) {
        setError(json?.error || 'Update failed')
        return
      }
      await refresh()
    } catch {
      setError('Network error')
    } finally {
      setSavingUser(null)
    }
  }

  const reset2fa = async (username: string) => {
    setSavingUser(username)
    setError(null)
    setResetFor(null)
    try {
      const res = await fetch('/api/admin/users/reset-2fa', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ username }),
      })
      const json = (await res.json().catch(() => null)) as any
      if (!res.ok || !json?.success) {
        setError(json?.error || '2FA reset failed')
        return
      }
      setResetFor({ username, qrDataUrl: json.data.qrDataUrl, secret: json.data.secret })
    } catch {
      setError('Network error')
    } finally {
      setSavingUser(null)
    }
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between gap-4 mb-4">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Safe Zone users</h3>
          <p className="text-xs font-mono text-muted-foreground mt-0.5">
            Accounts in the <span className="text-foreground/80">users</span> collection (gateway). Promote/demote by role.
          </p>
        </div>
        <button
          onClick={() => refresh()}
          className="text-xs font-mono px-2.5 py-1 rounded-md bg-surface border border-border text-muted-foreground hover:text-foreground hover:border-border-bright transition-colors"
          disabled={loading}
        >
          {loading ? 'Loading…' : 'Refresh'}
        </button>
      </div>

      {error && (
        <div className="mb-4 text-xs font-mono text-danger bg-danger/10 border border-danger/30 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      {resetFor && (
        <div className="mb-4 bg-background/40 border border-border rounded-xl p-4">
          <div className="text-xs font-mono text-muted-foreground mb-2">
            2FA reset for <span className="text-foreground">{resetFor.username}</span>. Scan this QR in an authenticator app.
          </div>
          <div className="flex gap-4 items-center flex-wrap">
            <img src={resetFor.qrDataUrl} alt="2FA QR code" className="w-44 h-44 rounded border border-border" />
            <div className="text-[11px] font-mono text-muted-foreground break-all">
              Secret (manual entry): <span className="text-foreground">{resetFor.secret}</span>
            </div>
          </div>
        </div>
      )}

      <div className="overflow-auto border border-border rounded-xl">
        <table className="w-full text-sm">
          <thead className="bg-surface-elevated text-muted-foreground text-xs font-mono">
            <tr>
              <th className="text-left px-3 py-2">Username</th>
              <th className="text-left px-3 py-2">Role</th>
              <th className="text-left px-3 py-2">Active</th>
              <th className="text-right px-3 py-2">Action</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map(u => (
              <UserRow
                key={u._id}
                user={u}
                saving={savingUser === u.username}
                onRoleChange={role => setUsers(prev => prev.map(x => (x._id === u._id ? { ...x, role } : x)))}
                onActiveChange={isActive => setUsers(prev => prev.map(x => (x._id === u._id ? { ...x, isActive } : x)))}
                onResetFa={() => reset2fa(u.username)}
                onSave={() => updateUser(u.username, { role: u.role, isActive: u.isActive })}
              />
            ))}
            {!sorted.length && (
              <tr>
                <td className="px-3 py-6 text-center text-xs font-mono text-muted-foreground" colSpan={4}>
                  No users found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default AdminUsersPanel
