'use client'

/**
 * LeafletMap — renders the geographic threat visualization.
 *
 * Architecture (per spec):
 *  - Honeypot server node: fixed at Holon Institute of Technology (HIT), Israel
 *  - Attacker nodes: plotted only when real lat/lng are known
 *  - Edges: polylines connecting each attacker to the honeypot server
 */

import { useEffect, useMemo, useRef } from 'react'
import { MapContainer, TileLayer, useMap } from 'react-leaflet'
import L from 'leaflet'
import { useSocket } from '@/features/dashboard/context/SocketContext'
import { geoLocationLabel, hasKnownCoords } from '@/lib/geoDisplay'

delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

const SERVER_LAT = 32.0139
const SERVER_LNG = 34.7725

const TRAP_COLORS: Record<string, string> = {
  SQL_INJECTION:  '#ef4444',
  SQLI:           '#ef4444',
  XSS:            '#06b6d4',
  RECON:          '#64748b',
  HONEY_TOKEN:    '#f97316',
  DATA_BOMB:      '#f59e0b',
  PATH_TRAVERSAL: '#8b5cf6',
  BRUTE_FORCE:    '#ec4899',
  XSS_PROBE:      '#06b6d4',
}

function makeCircleIcon(color: string, size = 14, pulse = false) {
  const div = document.createElement('div')
  div.style.cssText = `
    width:${size}px; height:${size}px; border-radius:50%;
    background:${color}; border:2px solid #ffffff40;
    box-shadow: 0 0 ${size / 2}px ${color}80;
    ${pulse ? `animation: pulse-orange 1.5s ease-in-out infinite;` : ''}
  `
  return L.divIcon({
    html: div,
    className: '',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  })
}

interface MapPoint {
  ip: string
  lat: number
  lng: number
  city: string
  country?: string
  geoPrecision?: string
  riskScore: number
  banned?: boolean
}

type ProfileLike = MapPoint

function hashString(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function jitterCoords(base: { lat: number; lng: number }, seed: string, strength = 0.06): { lat: number; lng: number } {
  const h = hashString(seed)
  const angle = ((h % 360) * Math.PI) / 180
  const radius = ((h >>> 8) % 1000) / 1000 * strength
  return {
    lat: base.lat + Math.sin(angle) * radius,
    lng: base.lng + Math.cos(angle) * radius,
  }
}

function AttackLayer({ profiles }: { profiles: ProfileLike[] }) {
  const { displayAlerts } = useSocket()
  const map = useMap()
  const layerRef = useRef<L.LayerGroup | null>(null)

  useEffect(() => {
    if (!layerRef.current) {
      layerRef.current = L.layerGroup().addTo(map)
    }
    const lg = layerRef.current
    lg.clearLayers()

    const serverIcon = makeCircleIcon('#0d9488', 18, true)
    L.marker([SERVER_LAT, SERVER_LNG], { icon: serverIcon })
      .bindTooltip('HIT Honeypot Server', { permanent: false, direction: 'top' })
      .addTo(lg)

    const seen = new Set<string>()

    profiles.forEach((point) => {
      if (seen.has(point.ip) || !hasKnownCoords(point.lat, point.lng)) return
      seen.add(point.ip)
      const color = point.banned ? '#64748b' : '#475569'
      const icon = makeCircleIcon(color, 8, false)
      const label = geoLocationLabel(point.city, point.country)
      L.marker([point.lat, point.lng], { icon })
        .bindTooltip(`${point.ip} · ${label}`, { direction: 'top' })
        .addTo(lg)
    })

    displayAlerts.slice(0, 50).forEach(alert => {
      if (!hasKnownCoords(alert.lat, alert.lng)) return

      const key = `${alert.attackerIp}|${alert.eventID}`
      const color = TRAP_COLORS[alert.trapType] ?? '#7a9bb5'
      const c = jitterCoords({ lat: alert.lat, lng: alert.lng }, key)
      const locationLabel = geoLocationLabel(alert.city, alert.country)

      const icon = makeCircleIcon(color, 12, false)
      L.marker([c.lat, c.lng], { icon })
        .bindPopup(
          `<div style="font-family:monospace;font-size:12px;color:#e2f0f7;background:#0d1820;padding:8px;border-radius:6px;border:1px solid #1e3044">
            <b style="color:${color}">${alert.trapType}</b><br/>
            IP: ${alert.attackerIp}<br/>
            Location: ${locationLabel}<br/>
            OS: ${alert.os}<br/>
            Risk: ${alert.riskScore ?? '?'}/100<br/>
            Wasted: ${(alert.wastedTimeMs / 1000).toFixed(1)}s
          </div>`,
          { className: 'leaflet-dark-popup' }
        )
        .addTo(lg)

      L.polyline(
        [[c.lat, c.lng], [SERVER_LAT, SERVER_LNG]],
        {
          color,
          weight: 1.5,
          opacity: 0.55,
          dashArray: '5, 6',
        }
      ).addTo(lg)
    })
  }, [displayAlerts, profiles, map])

  return null
}

export default function LeafletMap() {
  const { attackerProfiles } = useSocket()
  const profiles = useMemo(() => {
    return (attackerProfiles as unknown as ProfileLike[]) ?? []
  }, [attackerProfiles])

  return (
    <MapContainer
      center={[30, 15]}
      zoom={2}
      minZoom={2}
      maxZoom={10}
      style={{ width: '100%', height: '100%', minHeight: 400, background: '#070d10' }}
      zoomControl
      attributionControl
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://openstreetmap.org">OpenStreetMap</a>'
      />
      <AttackLayer profiles={profiles} />
    </MapContainer>
  )
}
