#!/usr/bin/env node
'use strict';

/**
 * Seed the fixed honey-token catalog into the malicious DB (idempotent).
 *
 * The catalog (packages/shared-constants/honeyTokens.js) is the single source
 * of truth for the bait credentials that leak through the gateway artifacts
 * (.env, .git/config, SQLi dump). Telemetry also seeds this on boot — this
 * script is for one-off/local seeding or QA.
 *
 * Usage (from repo root):
 *   node scripts/seed-honey-tokens.js
 *
 * Requires MALICIOUS_DB_URI (loads infra/.env when present).
 */

const path = require('path');

function loadEnv() {
  try {
    require('dotenv').config({ path: path.join(__dirname, '../infra/.env') });
  } catch {
    /* dotenv optional */
  }
}

async function main() {
  loadEnv();

  const uri = process.env.MALICIOUS_DB_URI;
  if (!uri) {
    console.error('Missing MALICIOUS_DB_URI');
    process.exit(1);
  }

  const { listHoneyTokens } = require('@evation/shared-constants/honeyTokens');
  const { createMaliciousConnection } = require('@evation/db-schemas');
  const conn = createMaliciousConnection(uri);
  await conn.asPromise();

  const HoneyToken = conn.model('HoneyToken');
  let upserts = 0;
  for (const entry of listHoneyTokens()) {
    await HoneyToken.updateOne(
      { catalogId: entry.catalogId },
      {
        $set: {
          catalogId: entry.catalogId,
          fakeUsername: entry.email,
          fakePassword: entry.value,
          tokenType: entry.tokenType,
          service: entry.service,
          scopes: entry.scopes || [],
          leakSource: entry.leakSource,
        },
        $setOnInsert: { isTriggered: false, triggeredLogs: [] },
      },
      { upsert: true },
    );
    upserts += 1;
    console.log(`  • ${entry.catalogId.padEnd(16)} ${entry.tokenType.padEnd(8)} ${entry.email}`);
  }

  console.log(`Seeded ${upserts} honey token(s) from the catalog (idempotent).`);
  await conn.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
