/* eslint-disable @typescript-eslint/no-explicit-any */
import mongoose from 'mongoose'

let cachedConn: any = null
let cachedConnPromise: Promise<any> | null = null

function getSafezoneDbUri() {
  return process.env.SAFEZONE_DB_URI || process.env.MONGODB_URI || ''
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

export async function getSafezoneConn() {
  if (cachedConn && cachedConn.readyState === 1) return cachedConn

  const uri = getSafezoneDbUri()
  if (!uri) throw new Error('Missing SAFEZONE_DB_URI (or MONGODB_URI) env var for safezone DB')

  if (!cachedConn) {
    cachedConn = mongoose.createConnection(uri, {
      serverSelectionTimeoutMS: 8000,
      connectTimeoutMS: 8000,
      bufferCommands: false,
    })
    cachedConn.model('RealEmployee', require('@evation/db-schemas').RealEmployeeSchema)
  }

  if (!cachedConnPromise) cachedConnPromise = ensureConnected(cachedConn)
  await cachedConnPromise
  return cachedConn
}

export async function getSafezoneModels() {
  const conn = await getSafezoneConn()
  const RealEmployee = conn.model('RealEmployee')
  return { RealEmployee, User: RealEmployee }
}

