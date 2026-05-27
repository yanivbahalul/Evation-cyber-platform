'use client'

/**
 * LeafletMap — renders the geographic threat visualization.
 *
 * Architecture (per spec):
 *  - Honeypot server node: fixed at Holon Institute of Technology (HIT), Israel
 *  - Attacker nodes: plotted from LiveAlert lat/lng coordinates
 *  - Edges: polylines connecting each attacker to the honeypot server
 *
 * This file is loaded via next/dynamic with ssr:false because Leaflet
 * accesses `window` and cannot be rendered server-side.
 */

import { useEffect, useRef, useState } from 'react'
import { MapContainer, TileLayer, useMap } from 'react-leaflet'
import L from 'leaflet'
import { useSocket } from '@/features/dashboard/context/SocketContext'

// Fix default Leaflet icon paths broken by webpack
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

// Honeypot server location — Holon Institute of Technology
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

/** Creates a circular SVG div-icon for a node */
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
  riskScore: number
  banned?: boolean
}

/** Draws/updates attacker nodes + edges on every new liveAlerts batch */
function AttackLayer({ historical }: { historical: MapPoint[] }) {
  const { liveAlerts } = useSocket()
  const map = useMap()
  const layerRef = useRef<L.LayerGroup | null>(null)

  useEffect(() => {
    if (!layerRef.current) {
      layerRef.current = L.layerGroup().addTo(map)
    }
    const lg = layerRef.current
    lg.clearLayers()

    // Server node
    const serverIcon = makeCircleIcon('#0d9488', 18, true)
    L.marker([SERVER_LAT, SERVER_LNG], { icon: serverIcon })
      .bindTooltip('HIT Honeypot Server', { permanent: false, direction: 'top' })
      .addTo(lg)

    const seen = new Set<string>()

    historical.forEach((point) => {
      if (seen.has(point.ip) || !point.lat || !point.lng) return
      seen.add(point.ip)
      const color = point.banned ? '#64748b' : '#475569'
      const icon = makeCircleIcon(color, 8, false)
      L.marker([point.lat, point.lng], { icon })
        .bindTooltip(`${point.ip} · ${point.city}`, { direction: 'top' })
        .addTo(lg)
    })

    // Attacker nodes + edges — deduplicate by IP to avoid overlapping markers
    liveAlerts.slice(0, 20).forEach(alert => {
      if (seen.has(alert.attackerIp)) return
      seen.add(alert.attackerIp)

      const color = TRAP_COLORS[alert.trapType] ?? '#7a9bb5'

      // Attacker node
      const icon = makeCircleIcon(color, 12, false)
      L.marker([alert.lat, alert.lng], { icon })
        .bindPopup(
          `<div style="font-family:monospace;font-size:12px;color:#e2f0f7;background:#0d1820;padding:8px;border-radius:6px;border:1px solid #1e3044">
            <b style="color:${color}">${alert.trapType}</b><br/>
            IP: ${alert.attackerIp}<br/>
            City: ${alert.city}<br/>
            OS: ${alert.os}<br/>
            Risk: ${alert.riskScore ?? '?'}/100<br/>
            Wasted: ${(alert.wastedTimeMs / 1000).toFixed(1)}s
          </div>`,
          { className: 'leaflet-dark-popup' }
        )
        .addTo(lg)

      // Edge — trajectory line attacker → server
      L.polyline(
        [[alert.lat, alert.lng], [SERVER_LAT, SERVER_LNG]],
        {
          color,
          weight: 1.5,
          opacity: 0.55,
          dashArray: '5, 6',
        }
      ).addTo(lg)
    })
  }, [liveAlerts, historical, map])

  return null
}

export default function LeafletMap() {
  const [historical, setHistorical] = useState<MapPoint[]>([])

  useEffect(() => {
    fetch('/api/admin/map', { credentials: 'include' })
      .then((res) => res.json())
      .then((json) => {
        if (json?.success && Array.isArray(json.data)) setHistorical(json.data)
      })
      .catch(() => {})
  }, [])

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
      <AttackLayer historical={historical} />
    </MapContainer>
  )
}
