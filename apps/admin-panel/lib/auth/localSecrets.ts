import { promises as fs } from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'

const LOCAL_DIR = path.join(process.cwd(), '.local')

async function ensureLocalDir() {
  await fs.mkdir(LOCAL_DIR, { recursive: true })
}

export async function readOrCreateLocalSecret(filename: string, bytes = 32) {
  await ensureLocalDir()
  const filePath = path.join(LOCAL_DIR, filename)
  try {
    const existing = await fs.readFile(filePath, 'utf8')
    const trimmed = existing.trim()
    if (trimmed) return trimmed
  } catch {
    // ignore
  }

  const value = crypto.randomBytes(bytes).toString('base64url')
  await fs.writeFile(filePath, value, { encoding: 'utf8', mode: 0o600 })
  return value
}

