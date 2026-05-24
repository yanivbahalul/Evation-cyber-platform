'use strict';

const connectMaliciousDB = require('../config/maliciousDb');
const attackLog = require('../utils/attackLog');
const { resolveIpGeo } = require('./geoService');

/**
 * Upsert attacker profile from a trap / live-alert payload (gateway or telemetryTracker).
 * @param {object} attackData
 */
async function upsertFromAttack(attackData) {
  const attackerIp = attackData?.attackerIp;
  if (!attackerIp) return null;

  const maliciousConn = connectMaliciousDB();
  if (!maliciousConn?.models?.AttackerProfile) return null;

  const AttackerProfile = maliciousConn.model('AttackerProfile');
  const geo = await resolveIpGeo(attackerIp);
  const fp = attackData.fingerprint || {};
  const riskDelta = 1 + (fp.riskScore || 0);

  const update = {
    $setOnInsert: { ip: attackerIp, firstSeen: Date.now() },
    $set: {
      lastSeen: Date.now(),
      city: geo.city,
      lat: geo.lat,
      lng: geo.lng,
      os: fp.os,
      platform: fp.platform,
      browser: fp.browserVersion || fp.browser,
      deviceType: fp.deviceType,
      isBot: !!fp.isBot,
    },
    $inc: { riskScore: riskDelta },
  };

  if (attackData.traceId) {
    update.$addToSet = { traceIds: attackData.traceId };
  }

  return AttackerProfile.findOneAndUpdate({ ip: attackerIp }, update, {
    upsert: true,
    returnDocument: 'after',
  });
}

async function upsertFromAttackSafe(attackData) {
  try {
    return await upsertFromAttack(attackData);
  } catch (err) {
    attackLog.error('TELEMETRY', 'attacker_profile_update_failed', {
      ip: attackData?.attackerIp,
      error: err.message,
    });
    return null;
  }
}

module.exports = { upsertFromAttack, upsertFromAttackSafe };
