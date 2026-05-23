/* eslint-disable @typescript-eslint/no-explicit-any */
import connectMaliciousDB from '@/lib/db/maliciousDb'

let cachedConn: any = null
let cachedConnPromise: Promise<any> | null = null

async function ensureConnected(conn: any) {
  // If already connected, fast path.
  // readyState: 0 = disconnected, 1 = connected, 2 = connecting, 3 = disconnecting
  if (conn?.readyState === 1) return conn
  if (typeof conn?.asPromise === 'function') {
    await conn.asPromise()
    return conn
  }
  // Worst case: wait for 'connected' event once.
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
  if (cachedConn && cachedConn.readyState === 1) return cachedConn
  if (!cachedConn) cachedConn = (connectMaliciousDB as any)()
  if (!cachedConnPromise) cachedConnPromise = ensureConnected(cachedConn)
  await cachedConnPromise
  return cachedConn
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

