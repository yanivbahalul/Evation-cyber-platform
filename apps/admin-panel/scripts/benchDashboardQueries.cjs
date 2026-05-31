/**
 * Benchmark dashboard Mongo queries (same shape as fetchDashboardData).
 *
 * Usage:
 *   pnpm --dir apps/admin-panel bench:dashboard
 *
 * Loads MALICIOUS_DB_URI from apps/admin-panel/.env or infra/.env.
 */
const path = require('path')
const fs = require('fs')

const repoRoot = path.join(__dirname, '../../..')
const dotenvQuiet = { quiet: true }

for (const envPath of [
  path.join(__dirname, '../.env'),
  path.join(repoRoot, 'infra/.env'),
]) {
  if (fs.existsSync(envPath)) {
    require('dotenv').config({ path: envPath, ...dotenvQuiet })
    if (process.env.MALICIOUS_DB_URI) break
  }
}

const DASHBOARD_EVENTS_LIMIT_MAX = 500
const DASHBOARD_PROFILES_LIMIT = 500
const DASHBOARD_HONEY_TOKENS_LIMIT = 200

async function loadModels() {
  const { createMaliciousConnection } = require('@evation/db-schemas')
  const uri = process.env.MALICIOUS_DB_URI
  if (!uri) {
    console.log('SKIP: MALICIOUS_DB_URI not set (apps/admin-panel/.env or infra/.env)')
    process.exit(0)
  }
  const conn = createMaliciousConnection(uri)
  await conn.asPromise()
  return {
    conn,
    AttackEvent: conn.model('AttackEvent'),
    AttackerProfile: conn.model('AttackerProfile'),
    HoneyToken: conn.model('HoneyToken'),
  }
}

async function bench(label, fn) {
  const t0 = process.hrtime.bigint()
  const result = await fn()
  const ms = Number(process.hrtime.bigint() - t0) / 1e6
  const count = Array.isArray(result) ? result.length : result ? 1 : 0
  console.log(`${label.padEnd(44)} ${ms.toFixed(1).padStart(7)} ms  rows: ${count}`)
  return ms
}

async function main() {
  const { conn, AttackEvent, AttackerProfile, HoneyToken } = await loadModels()

  const [eventCount, profileCount, tokenCount] = await Promise.all([
    AttackEvent.estimatedDocumentCount(),
    AttackerProfile.estimatedDocumentCount(),
    HoneyToken.estimatedDocumentCount(),
  ])
  console.log(`Collections: events=${eventCount} profiles=${profileCount} tokens=${tokenCount}`)
  console.log(
    `Limits: events=${DASHBOARD_EVENTS_LIMIT_MAX} profiles=${DASHBOARD_PROFILES_LIMIT} tokens=${DASHBOARD_HONEY_TOKENS_LIMIT}`,
  )
  console.log('--- individual queries ---')

  await bench('AttackEvent (timestamp desc, limit)', () =>
    AttackEvent.find().sort({ timestamp: -1 }).limit(DASHBOARD_EVENTS_LIMIT_MAX).lean(),
  )
  await bench('AttackerProfile (riskScore desc, limit)', () =>
    AttackerProfile.find().sort({ riskScore: -1 }).limit(DASHBOARD_PROFILES_LIMIT).lean(),
  )
  await bench('HoneyToken (limit)', () =>
    HoneyToken.find().sort({ _id: -1 }).limit(DASHBOARD_HONEY_TOKENS_LIMIT).lean(),
  )

  await bench('Timeline by IP', async () => {
    const row = await AttackerProfile.findOne({}).select('ip').lean()
    if (!row?.ip) return []
    return AttackEvent.find({ attackerIp: row.ip }).sort({ timestamp: 1 }).limit(200).lean()
  })

  console.log('--- fetchDashboardData bundle ---')
  await bench('Promise.all (warm run 1)', async () => {
    await Promise.all([
      AttackEvent.find().sort({ timestamp: -1 }).limit(DASHBOARD_EVENTS_LIMIT_MAX).lean(),
      AttackerProfile.find().sort({ riskScore: -1 }).limit(DASHBOARD_PROFILES_LIMIT).lean(),
      HoneyToken.find().sort({ _id: -1 }).limit(DASHBOARD_HONEY_TOKENS_LIMIT).lean(),
    ])
  })

  const warmRuns = []
  for (let i = 0; i < 5; i++) {
    const t0 = process.hrtime.bigint()
    await Promise.all([
      AttackEvent.find().sort({ timestamp: -1 }).limit(DASHBOARD_EVENTS_LIMIT_MAX).lean(),
      AttackerProfile.find().sort({ riskScore: -1 }).limit(DASHBOARD_PROFILES_LIMIT).lean(),
      HoneyToken.find().sort({ _id: -1 }).limit(DASHBOARD_HONEY_TOKENS_LIMIT).lean(),
    ])
    warmRuns.push(Number(process.hrtime.bigint() - t0) / 1e6)
  }
  warmRuns.sort((a, b) => a - b)
  console.log(
    `Warm median (5 runs)`.padEnd(44),
    `${warmRuns[2].toFixed(1).padStart(7)} ms`,
  )

  await conn.close()
}

main().catch((err) => {
  console.error('FAIL', err.message)
  process.exit(1)
})
