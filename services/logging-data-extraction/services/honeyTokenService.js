'use strict';

const connectMaliciousDB = require('../config/maliciousDb');
const { attackLog } = require('@evation/shared-utils');

function honeyTokenModel() {
  const conn = connectMaliciousDB();
  if (!conn?.models?.HoneyToken) throw new Error('HoneyToken model unavailable');
  return conn.model('HoneyToken');
}

/** Persist a freshly issued bait credential. */
async function create({ fakeUsername, fakePassword }) {
  const doc = await honeyTokenModel().create({ fakeUsername, fakePassword });
  return { id: String(doc._id), fakeUsername };
}

/** Look up whether a presented value matches an issued bait credential. */
async function check(value) {
  if (!value) return { hit: false };
  const found = await honeyTokenModel().findOne({ fakePassword: value }).lean();
  return found ? { hit: true, fakeUsername: found.fakeUsername } : { hit: false };
}

/** Flag a bait credential as used and append a usage record. */
async function recordUsage(value, ctx = {}) {
  if (!value) return;
  await honeyTokenModel().updateOne(
    { fakePassword: value },
    {
      $set: { isTriggered: true },
      $push: {
        triggeredLogs: {
          attackerIp: ctx.attackerIp || 'unknown',
          networkContext: ctx.networkContext || 'HTTP',
        },
      },
    },
  );
  attackLog.info('TELEMETRY', 'honey_token_usage_recorded', {
    ip: ctx.attackerIp,
    token_prefix: String(value).slice(0, 12),
  });
}

module.exports = { create, check, recordUsage };
