#!/usr/bin/env node
'use strict';

/**
 * Re-resolve geo for attacker profiles with missing or stale location data.
 *
 * Usage (from repo root):
 *   node services/logging-data-extraction/scripts/backfillGeo.js
 *   node services/logging-data-extraction/scripts/backfillGeo.js --dry-run
 */

const path = require('path');
const fs = require('fs');

const serviceRoot = path.join(__dirname, '..');
const repoRoot = path.join(serviceRoot, '../..');

const dotenvQuiet = { quiet: true };
require('dotenv').config({ path: path.join(repoRoot, 'infra/.env'), ...dotenvQuiet });
const adminEnvPath = path.join(repoRoot, 'apps/admin-panel/.env');
if (fs.existsSync(adminEnvPath) && !process.env.MALICIOUS_DB_URI) {
  require('dotenv').config({ path: adminEnvPath, ...dotenvQuiet });
}

const connectMaliciousDB = require('../config/maliciousDb');
const { resolveIpGeo, hasValidCoords } = require('../services/geoService');

const dryRun = process.argv.includes('--dry-run');

async function main() {
  const conn = connectMaliciousDB();
  await conn.asPromise();

  const AttackerProfile = conn.model('AttackerProfile');

  const candidates = await AttackerProfile.find({
    $or: [
      { city: { $in: [null, '', 'Unknown', '—', 'Tel Aviv'] } },
      { lat: { $in: [null, 0] } },
      { lng: { $in: [null, 0] } },
      { geoSource: { $exists: false } },
      { geoSource: { $in: ['none', 'pending', 'fallback'] } },
    ],
  })
    .select('ip city country lat lng geoSource')
    .lean();

  console.log(`Found ${candidates.length} profile(s) to refresh${dryRun ? ' (dry run)' : ''}.`);

  let updated = 0;
  for (const row of candidates) {
    const ip = String(row.ip || '').trim();
    if (!ip) continue;

    const geo = await resolveIpGeo(ip);
    if (!geo?.city || geo.city === 'Unknown') {
      console.log(`  skip ${ip} — still unknown`);
      continue;
    }

    const patch = {
      city: geo.city,
      country: geo.country,
      countryCode: geo.countryCode,
      geoSource: geo.source,
      geoPrecision: geo.precision,
      isp: geo.isp,
      lat: hasValidCoords(geo.lat, geo.lng) ? geo.lat : null,
      lng: hasValidCoords(geo.lat, geo.lng) ? geo.lng : null,
    };

    console.log(`  ${ip}: ${row.city ?? '—'} → ${patch.city} (${patch.geoSource})`);

    if (!dryRun) {
      await AttackerProfile.updateOne({ ip }, { $set: patch });
    }
    updated += 1;
  }

  console.log(`Done. ${updated} profile(s) ${dryRun ? 'would be ' : ''}updated.`);
  await conn.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
