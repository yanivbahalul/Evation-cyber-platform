/* eslint-disable @typescript-eslint/no-explicit-any */
import connectMaliciousDB from '@/lib/db/maliciousDb'

type TelemetryGlobal = typeof globalThis & {
  __telemetryDbConn?: any
}

const getGlobal = (): TelemetryGlobal => globalThis as TelemetryGlobal

const ensureConnected = async (conn: any) => {
  // readyState: 0 = disconnected, 1 = connected, 2 = connecting, 3 = disconnecting
  if (conn?.readyState === 1) return conn
  if (typeof conn?.asPromise === 'function') {
    await conn.asPromise()
    return conn
  }
  await new Promise<void>((resolve, reject) => {
    function cleanup() {
      conn.off?.('connected', onConnected)
      conn.off?.('error', onError)
    }
    function onConnected() {
      cleanup()
      resolve()
    }
    function onError(err: unknown) {
      cleanup()
      reject(err)
    }
    conn.on?.('connected', onConnected)
    conn.on?.('error', onError)
  })
  return conn
}

export const getTelemetryConn = async () => {
  const telemetryGlobal = getGlobal()
  if (!telemetryGlobal.__telemetryDbConn) {
    telemetryGlobal.__telemetryDbConn = (connectMaliciousDB as any)()
  }
  const conn = telemetryGlobal.__telemetryDbConn
  if (conn?.readyState === 1) return conn
  await ensureConnected(conn)
  return conn
}

export const getTelemetryModels = async () => {
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
  getTelemetryConn().catch(() => {
    /* warm connect is best-effort at boot */
  })
}
