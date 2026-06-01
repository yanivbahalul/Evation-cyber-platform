/* eslint-disable @typescript-eslint/no-explicit-any */
import connectMaliciousDB from '@/lib/db/maliciousDb'

type TelemetryGlobal = typeof globalThis & {
  __telemetryDbConn?: any
}

function getGlobal(): TelemetryGlobal {
  return globalThis as TelemetryGlobal
}

async function ensureConnected(conn: any) {
  // readyState: 0 = disconnected, 1 = connected, 2 = connecting, 3 = disconnecting
  if (conn?.readyState === 1) return conn
  if (typeof conn?.asPromise === 'function') {
    await conn.asPromise()
    return conn
  }
  await new Promise<void>((resolve, reject) => {
    const onConnected = () => {
      cleanup()
      resolve()
    }
    const onError = (err: unknown) => {
      cleanup()
      reject(err)
    }
    const cleanup = () => {
      conn.off?.('connected', onConnected)
      conn.off?.('error', onError)
    }
    conn.on?.('connected', onConnected)
    conn.on?.('error', onError)
  })
  return conn
}

export async function getTelemetryConn() {
  const g = getGlobal()
  if (!g.__telemetryDbConn) {
    g.__telemetryDbConn = (connectMaliciousDB as any)()
  }
  const conn = g.__telemetryDbConn
  if (conn?.readyState === 1) return conn
  await ensureConnected(conn)
  return conn
}

export async function getTelemetryModels() {
  const conn = await getTelemetryConn()
  return {
    AttackerProfile: conn.model('AttackerProfile'),
    AttackEvent: conn.model('AttackEvent'),
    HoneyToken: conn.model('HoneyToken'),
    AdminUser: conn.model('AdminUser'),
  }
}

// Warm Mongo on server boot so the first dashboard load is not blocked on connect.
if (process.env.MALICIOUS_DB_URI) {
  getTelemetryConn().catch(() => {})
}
