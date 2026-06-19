'use strict';

const connectMaliciousDB = require('../config/maliciousDb');
const { attackLog } = require('@evation/shared-utils');
const { listHoneyTokens, findHoneyToken } = require('@evation/shared-constants/honeyTokens');

function honeyTokenModel() {
  const conn = connectMaliciousDB();
  if (!conn?.models?.HoneyToken) throw new Error('HoneyToken model unavailable');
  return conn.model('HoneyToken');
}

/**
 * Idempotently plant the shared honey-token catalog in the malicious DB.
 * Upserts provenance by catalogId while preserving any existing trigger state
 * (isTriggered / triggeredLogs) so re-seeding never wipes forensic history.
 */
async function seedCatalog() {
  const model = honeyTokenModel();
  let upserts = 0;
  for (const entry of listHoneyTokens()) {
    await model.updateOne(
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
  }
  attackLog.info('TELEMETRY', 'honey_token_catalog_seeded', { count: upserts });
  return upserts;
}

/** Persist a freshly issued bait credential (legacy path; catalog is preferred). */
async function create({ fakeUsername, fakePassword }) {
  const doc = await honeyTokenModel().create({ fakeUsername, fakePassword });
  return { id: String(doc._id), fakeUsername };
}

/**
 * Look up whether a presented value matches an issued bait credential.
 * Resolves catalog provenance first (covers AWS secret keys too), then falls
 * back to a direct fakePassword lookup for legacy/minted tokens.
 */
async function check(value) {
  if (!value) return { hit: false };

  const entry = findHoneyToken(value);
  if (entry) {
    return {
      hit: true,
      catalogId: entry.catalogId,
      fakeUsername: entry.email,
      tokenType: entry.tokenType,
      service: entry.service,
      scopes: entry.scopes || [],
      leakSource: entry.leakSource,
    };
  }

  const found = await honeyTokenModel().findOne({ fakePassword: value }).lean();
  if (!found) return { hit: false };
  return {
    hit: true,
    catalogId: found.catalogId,
    fakeUsername: found.fakeUsername,
    tokenType: found.tokenType,
    service: found.service,
    scopes: found.scopes || [],
    leakSource: found.leakSource,
  };
}

/** Flag a bait credential as used and append a forensic usage record. */
async function recordUsage(value, ctx = {}) {
  if (!value) return;

  const entry = findHoneyToken(value);
  const filter = entry ? { catalogId: entry.catalogId } : { fakePassword: value };

  await honeyTokenModel().updateOne(filter, {
    $set: { isTriggered: true },
    $push: {
      triggeredLogs: {
        attackerIp: ctx.attackerIp || 'unknown',
        networkContext: ctx.networkContext || 'HTTP',
        method: ctx.method,
        path: ctx.path,
        userAgent: ctx.userAgent,
        outcome: ctx.outcome,
        traceId: ctx.traceId,
      },
    },
  });

  attackLog.info('TELEMETRY', 'honey_token_usage_recorded', {
    ip: ctx.attackerIp,
    token_prefix: String(value).slice(0, 12),
    outcome: ctx.outcome,
    path: ctx.path,
  });
}

module.exports = { seedCatalog, create, check, recordUsage };
