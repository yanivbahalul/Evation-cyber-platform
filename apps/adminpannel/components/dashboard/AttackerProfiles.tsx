'use client'

import { useState } from 'react'
import { useSocket, type AttackerProfile } from '@/context/SocketContext'
import { Bot, Monitor, MapPin, Ban } from 'lucide-react'

export default function AttackerProfiles() {
  const { attackerProfiles } = useSocket()
  const [selected, setSelected] = useState<AttackerProfile | null>(null)
  const [bannedIps, setBannedIps] = useState<Set<string>>(new Set())

  const toggleBan = (ip: string) => {
    setBannedIps(prev => {
      const next = new Set(prev)
      if (next.has(ip)) next.delete(ip)
      else next.add(ip)
      return next
    })
  }

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* Summary */}
      <div className="grid grid-cols-4 gap-3">
        <MiniStat label="Total Profiles"   value={attackerProfiles.length}                                              color="text-primary" />
        <MiniStat label="Bots Detected"    value={attackerProfiles.filter(p => p.isBot).length}                        color="text-danger" />
        <MiniStat label="High Risk (≥80)"  value={attackerProfiles.filter(p => p.riskScore >= 80).length}              color="text-accent" />
        <MiniStat label="Banned"           value={bannedIps.size}                                                      color="text-muted-foreground" />
      </div>

      {/* Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 overflow-y-auto flex-1 min-h-0 content-start">
        {attackerProfiles.map(profile => (
          <ProfileCard
            key={profile.ip}
            profile={profile}
            banned={bannedIps.has(profile.ip)}
            isSelected={selected?.ip === profile.ip}
            onSelect={() => setSelected(s => s?.ip === profile.ip ? null : profile)}
            onBan={() => toggleBan(profile.ip)}
          />
        ))}
      </div>

      {/* Detail */}
      {selected && (
        <div className="bg-surface border border-primary/30 rounded-xl p-4 text-xs font-mono">
          <div className="flex items-center justify-between mb-3">
            <span className="text-primary font-bold uppercase tracking-widest text-[10px]">Attacker Profile — Dual-Storage View</span>
            <button onClick={() => setSelected(null)} className="text-muted-foreground hover:text-foreground">✕</button>
          </div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">
            <Row label="ip"          value={selected.ip} />
            <Row label="city"        value={selected.city} />
            <Row label="coordinates" value={`[${selected.lat}, ${selected.lng}]`} />
            <Row label="os"          value={selected.os} />
            <Row label="platform"    value={selected.platform ?? '—'} />
            <Row label="browser"     value={selected.browser} />
            <Row label="deviceType"  value={selected.deviceType ?? '—'} />
            <Row label="isBot"       value={String(selected.isBot)} highlight={selected.isBot ? '#ef4444' : '#22c55e'} />
            <Row label="riskScore"   value={`${selected.riskScore}/100`} highlight={riskColor(selected.riskScore)} />
            <Row label="firstSeen"   value={new Date(selected.firstSeen).toISOString()} />
            <Row label="lastSeen"    value={new Date(selected.lastSeen).toISOString()} />
          </div>
        </div>
      )}
    </div>
  )
}

function ProfileCard({
  profile, banned, isSelected, onSelect, onBan,
}: {
  profile: AttackerProfile
  banned: boolean
  isSelected: boolean
  onSelect: () => void
  onBan: () => void
}) {
  const rc = riskColor(profile.riskScore)
  return (
    <div
      onClick={onSelect}
      className={`bg-surface border rounded-xl p-4 cursor-pointer transition-all group ${
        isSelected ? 'border-primary/50 bg-primary/5' : banned ? 'border-danger/30 bg-danger/5' : 'border-border hover:border-border-bright'
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          {profile.isBot
            ? <Bot className="w-4 h-4 text-danger shrink-0" />
            : <Monitor className="w-4 h-4 text-muted-foreground shrink-0" />
          }
          <span className="text-sm font-mono font-bold text-foreground">{profile.ip}</span>
          {banned && (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-danger/20 text-danger border border-danger/30">BANNED</span>
          )}
        </div>

        {/* Risk badge */}
        <span
          className="text-[10px] font-bold font-mono px-2 py-0.5 rounded shrink-0"
          style={{ background: `${rc}20`, color: rc, border: `1px solid ${rc}40` }}
        >
          {profile.riskScore}/100
        </span>
      </div>

      <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-mono mb-1">
        <MapPin className="w-3 h-3 shrink-0" />
        {profile.city}
      </div>
      <div className="flex items-center gap-3 text-xs text-muted-foreground font-mono">
        <span>{profile.os}</span>
        <span className="text-border">|</span>
        <span className="truncate">{profile.browser}</span>
      </div>

      {/* Risk bar */}
      <div className="mt-3 h-1 bg-surface-elevated rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${profile.riskScore}%`, background: rc }}
        />
      </div>

      {/* Ban button */}
      <div className="mt-3 flex justify-end">
        <button
          onClick={e => { e.stopPropagation(); onBan() }}
          className={`flex items-center gap-1.5 text-[10px] font-mono px-2.5 py-1 rounded-md border transition-colors ${
            banned
              ? 'bg-success/10 border-success/30 text-success hover:bg-success/20'
              : 'bg-danger/10 border-danger/30 text-danger hover:bg-danger/20'
          }`}
        >
          <Ban className="w-3 h-3" />
          {banned ? 'Unban IP' : 'Ban IP'}
        </button>
      </div>
    </div>
  )
}

function MiniStat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-surface border border-border rounded-xl px-4 py-3">
      <p className={`text-2xl font-bold ${color} leading-none`}>{value}</p>
      <p className="text-[10px] font-mono text-muted-foreground mt-1">{label}</p>
    </div>
  )
}

function Row({ label, value, highlight }: { label: string; value: string; highlight?: string }) {
  return (
    <div className="flex gap-2">
      <span className="text-muted-foreground/60 shrink-0">{label}:</span>
      <span style={highlight ? { color: highlight } : {}} className="text-foreground break-all">{value}</span>
    </div>
  )
}

function riskColor(score: number) {
  if (score >= 90) return '#ef4444'
  if (score >= 75) return '#f97316'
  if (score >= 50) return '#f59e0b'
  return '#22c55e'
}
