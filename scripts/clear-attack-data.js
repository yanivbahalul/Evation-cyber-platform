#!/usr/bin/env node
'use strict';

/**
 * Wipe malicious-DB telemetry collections (attack events, profiles, honey tokens).
 * Same operations as POST /api/admin/maintenance in the admin panel.
 *
 * Usage (from repo root):
 *   node scripts/clear-attack-data.js [--all | --events | --profiles | --tokens]
 *
 * Requires MALICIOUS_DB_URI in the environment (or infra/.env via dotenv).
 */

const path = require('path');

function loadEnv() {
  try {
    require('dotenv').config({ path: path.join(__dirname, '../infra/.env') });
  } catch {
    /* dotenv optional */
  }
}

const ACTIONS = {
  events: {
    label: 'attack events',
    run: (models) => models.AttackEvent.deleteMany({}),
  },
  profiles: {
    label: 'attacker profiles',
    run: (models) => models.AttackerProfile.deleteMany({}),
  },
  tokens: {
    label: 'honey tokens',
    run: (models) => models.HoneyToken.deleteMany({}),
  },
};

async function main() {
  loadEnv();

  const uri = process.env.MALICIOUS_DB_URI;
  if (!uri) {
    console.error('Missing MALICIOUS_DB_URI');
    process.exit(1);
  }

  const arg = process.argv[2] || '--all';
  const selected =
    arg === '--all'
      ? ['events', 'profiles', 'tokens']
      : arg === '--events'
        ? ['events']
        : arg === '--profiles'
          ? ['profiles']
          : arg === '--tokens'
            ? ['tokens']
            : null;

  if (!selected) {
    console.error('Usage: node scripts/clear-attack-data.js [--all | --events | --profiles | --tokens]');
    process.exit(1);
  }

  const { createMaliciousConnection } = require('@evation/db-schemas');
  const conn = createMaliciousConnection(uri);
  await conn.asPromise();

  const models = {
    AttackEvent: conn.model('AttackEvent'),
    AttackerProfile: conn.model('AttackerProfile'),
    HoneyToken: conn.model('HoneyToken'),
  };

  for (const key of selected) {
    const spec = ACTIONS[key];
    const result = await spec.run(models);
    console.log(`Deleted ${result.deletedCount ?? 0} ${spec.label}`);
  }

  await conn.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
