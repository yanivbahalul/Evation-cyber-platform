/* eslint-disable @typescript-eslint/no-explicit-any */
import mongoose from 'mongoose'

let cachedConn: any = null
let cachedConnPromise: Promise<any> | null = null

function getAdminDbUri() {
  // Prefer dedicated ADMIN_DB_URI; fall back to SAFEZONE_DB_URI to keep setups simple.
  return process.env.ADMIN_DB_URI || process.env.SAFEZONE_DB_URI || ''
}

async function ensureConnected(conn: any) {
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

export async function getAdminConn() {
  if (cachedConn && cachedConn.readyState === 1) return cachedConn

  const uri = getAdminDbUri()
  if (!uri) throw new Error('Missing ADMIN_DB_URI (or SAFEZONE_DB_URI) env var for admin auth DB')

  if (!cachedConn) {
    cachedConn = mongoose.createConnection(uri, {
      serverSelectionTimeoutMS: 8000,
      connectTimeoutMS: 8000,
      bufferCommands: false,
    })
    cachedConn.model('AdminUser', require('@/lib/models/AdminUser'))
  }

  if (!cachedConnPromise) cachedConnPromise = ensureConnected(cachedConn)
  await cachedConnPromise
  return cachedConn
}

export async function getAdminModels() {
  const conn = await getAdminConn()
  return { AdminUser: conn.model('AdminUser') }
}

