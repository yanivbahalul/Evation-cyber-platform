import type { AttackEvent, AttackerProfile, HoneyToken } from '@/lib/types/telemetry'

const STORAGE_KEY = 'evation_admin_dashboard_v1'
/** Show cached data instantly; background refresh replaces it when ready. */
export const DASHBOARD_CACHE_TTL_MS = 15 * 60 * 1000

export interface DashboardSnapshot {
  events: AttackEvent[]
  profiles: AttackerProfile[]
  honeyTokens: HoneyToken[]
  savedAt: number
}

function isBrowser() {
  return typeof window !== 'undefined'
}

export function readDashboardCache(): DashboardSnapshot | null {
  if (!isBrowser()) return null
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as DashboardSnapshot
    if (!parsed?.savedAt || !Array.isArray(parsed.events)) return null
    if (Date.now() - parsed.savedAt > DASHBOARD_CACHE_TTL_MS) {
      sessionStorage.removeItem(STORAGE_KEY)
      return null
    }
    return parsed
  } catch {
    return null
  }
}

export function writeDashboardCache(data: Omit<DashboardSnapshot, 'savedAt'>) {
  if (!isBrowser()) return
  try {
    const snapshot: DashboardSnapshot = { ...data, savedAt: Date.now() }
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot))
  } catch {
    // quota / private mode
  }
}

export function clearDashboardCache() {
  if (!isBrowser()) return
  try {
    sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore
  }
}
