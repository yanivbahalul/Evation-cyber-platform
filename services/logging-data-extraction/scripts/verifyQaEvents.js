/**
 * Verify recent attack_events after QA smoke (run from logging-data-extraction package).
 */
const path = require('path');
const fs = require('fs');

const adminEnv = path.join(__dirname, '../../../apps/admin-panel/.env.local');
if (fs.existsSync(adminEnv)) require('dotenv').config({ path: adminEnv, quiet: true });

const uri = process.env.MALICIOUS_DB_URI;
if (!uri) {
  console.log('SKIP verifyQaEvents: MALICIOUS_DB_URI not set');
  process.exit(0);
}

const mongoose = require('mongoose');

const GROUPS = [
  ['SQLI', 'SQL_INJECTION'],
  ['XSS', 'XSS_PROBE'],
  ['DATA_BOMB'],
  ['BRUTE_FORCE'],
  ['RECON'],
  ['PATH_TRAVERSAL'],
  ['SSRF'],
  ['SCANNER'],
];

(async () => {
  await mongoose.connect(uri);
  const col = mongoose.connection.db.collection('attack_events');
  const since = new Date(Date.now() - 15 * 60 * 1000);
  const events = await col
    .find({ timestamp: { $gte: since } })
    .project({ trapType: 1, traceId: 1 })
    .limit(500)
    .toArray();

  const types = new Set(events.map((e) => e.trapType).filter(Boolean));
  let pass = 0;
  let fail = 0;

  for (const group of GROUPS) {
    if (group.some((t) => types.has(t))) {
      console.log(`PASS T-events ${group[0]} in DB`);
      pass++;
    } else {
      console.log(`FAIL T-events missing ${group.join('|')} (have: ${[...types].join(', ') || 'none'})`);
      fail++;
    }
  }

  const traces = [...new Set(events.map((e) => e.traceId).filter(Boolean))];
  if (traces.length >= 1) {
    console.log(`PASS T-KC traceId present (${traces.length} traces, ${events.length} events)`);
    pass++;
  } else {
    console.log('FAIL T-KC no traceId on recent events');
    fail++;
  }

  await mongoose.disconnect();
  console.log(`=== Events verify: PASS=${pass} FAIL=${fail} ===`);
  process.exit(fail > 0 ? 1 : 0);
})().catch((err) => {
  console.error('FAIL verifyQaEvents', err.message);
  process.exit(1);
});
