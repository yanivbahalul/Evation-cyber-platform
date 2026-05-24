'use strict';

const connectMaliciousDB = require('../config/maliciousDb');
const attackLog = require('../utils/attackLog');
const { resolveIpGeo } = require('./geoService');

const MAX_TRACE_IDS = 500;

function geoFromAttackData(attackData) {
  const city = attackData?.city;
  if (!city || city === 'Unknown') return null;
  return {
    city,
    lat: attackData.lat ?? null,
    lng: attackData.lng ?? null,
  };
}

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
  const callerGeo = geoFromAttackData(attackData);
  const geo = callerGeo || (await resolveIpGeo(attackerIp));
  const fp = attackData.fingerprint || {};
  const riskDelta = 1 + (fp.riskScore || 0);
  const now = new Date();

  const update = {
    $setOnInsert: { ip: attackerIp, firstSeen: now },
    $set: {
      lastSeen: now,
      city: geo.city,
      lat: geo.lat ?? 0,
      lng: geo.lng ?? 0,
      os: fp.os,
      platform: fp.platform,
      browser: fp.browserVersion || fp.browser,
      deviceType: fp.deviceType,
      isBot: !!fp.isBot,
    },
    $inc: { riskScore: riskDelta },
  };

  if (attackData.traceId) {
    update.$push = {
      traceIds: { $each: [attackData.traceId], $slice: -MAX_TRACE_IDS },
    };
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
