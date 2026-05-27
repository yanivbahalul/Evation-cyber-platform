#!/usr/bin/env node
// Wipe attack telemetry from the MALICIOUS_DB so the admin dashboard is clean.
// Usage: MALICIOUS_DB_URI=... node scripts/clear-attack-data.js
//   or:  node -r dotenv/config scripts/clear-attack-data.js dotenv_config_path=apps/admin-panel/.env

const { MongoClient } = require('mongodb');

const uri = process.env.MALICIOUS_DB_URI;
if (!uri) {
  console.error('MALICIOUS_DB_URI is not set. Export it or pass via dotenv.');
  process.exit(1);
}

(async () => {
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db();
  console.log(`Connected to ${db.databaseName}`);

  for (const name of ['attack_events', 'attackerprofiles', 'honeytokens']) {
    const res = await db.collection(name).deleteMany({});
    console.log(`  ${name}: deleted ${res.deletedCount}`);
  }

  await client.close();
  console.log('Done.');
})().catch(err => {
  console.error(err);
  process.exit(1);
});
