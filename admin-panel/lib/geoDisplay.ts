import type { AttackerProfile } from '@/lib/types/telemetry'

export function isUnknownCoords(lat: unknown, lng: unknown): boolean {
  if (typeof lat !== 'number' || typeof lng !== 'number') return true
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return true
  return lat === 0 && lng === 0
}

export function hasKnownCoords(lat: unknown, lng: unknown): boolean {
  return !isUnknownCoords(lat, lng)
}

export function isUnknownCity(city: unknown): boolean {
  const c = String(city ?? '').trim()
  return !c || c === 'Unknown' || c === '—'
}

export interface GeoLike {
  city?: string
  country?: string
  lat?: number
  lng?: number
  geoPrecision?: string
}

export function pickCity(primary?: GeoLike | null, fallback?: GeoLike | null): string {
  if (primary?.city && !isUnknownCity(primary.city)) return primary.city
  if (fallback?.city && !isUnknownCity(fallback.city)) return fallback.city
  if (primary?.country && !isUnknownCity(primary.country)) return primary.country
  if (fallback?.country && !isUnknownCity(fallback.country)) return fallback.country
  return 'Unknown'
}

export function pickCoords(primary?: GeoLike | null, fallback?: GeoLike | null): { lat: number; lng: number } {
  if (primary && hasKnownCoords(primary.lat, primary.lng)) {
    return { lat: primary.lat as number, lng: primary.lng as number }
  }
  if (fallback && hasKnownCoords(fallback.lat, fallback.lng)) {
    return { lat: fallback.lat as number, lng: fallback.lng as number }
  }
  return { lat: 0, lng: 0 }
}

/** Merge alert-level geo with the persisted attacker profile (profile wins when alert is incomplete). */
export function mergeEventGeo(
  alert: GeoLike & { attackerIp?: string },
  profile?: AttackerProfile | null,
): { city: string; country?: string; lat: number; lng: number; geoPrecision?: string } {
  const coords = pickCoords(alert, profile)
  return {
    city: pickCity(alert, profile),
    country: profile?.country || undefined,
    lat: coords.lat,
    lng: coords.lng,
    geoPrecision: profile?.geoPrecision || alert.geoPrecision,
  }
}

export function geoLocationLabel(city: string, country?: string): string {
  if (isUnknownCity(city)) return country && !isUnknownCity(country) ? country : 'Unknown'
  if (country && !city.toLowerCase().includes(country.toLowerCase())) {
    return `${city}, ${country}`
  }
  return city
}

export function isLanGeo(profile?: GeoLike | null): boolean {
  const p = profile?.geoPrecision
  return p === 'lan' || p === 'lan-egress' || profile?.city === 'LAN / Local'
}

export function mapTooltipLabel(city: string, country: string | undefined, unknownCoords: boolean): string {
  if (unknownCoords && isUnknownCity(city)) return 'Location unknown'
  if (unknownCoords && !isUnknownCity(city)) return city
  if (unknownCoords) return 'Location unknown'
  if (isLanGeo({ city, geoPrecision: undefined })) return city
  return geoLocationLabel(city, country)
}
