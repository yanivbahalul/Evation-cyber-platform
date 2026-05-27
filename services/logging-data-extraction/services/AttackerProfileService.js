'use strict';

const connectMaliciousDB = require('../config/maliciousDb');
const attackLog = require('../utils/attackLog');
const { resolveIpGeo } = require('./geoService');

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

  const $set = {
    lastSeen: now,
    city: geo.city,
    lat: geo.lat ?? 0,
    lng: geo.lng ?? 0,
    os: fp.os,
    platform: fp.platform,
    browser: fp.browserVersion || fp.browser,
    deviceType: fp.deviceType,
    isBot: !!fp.isBot,
  };
  if (geo.isp) $set.isp = geo.isp;
  if (fp.screenResolution) $set.screenResolution = fp.screenResolution;

  const update = {
    $setOnInsert: { ip: attackerIp, firstSeen: now },
    $set,
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

/**
 * Beacon-only update: records screen resolution for an attacker IP that
 * ALREADY exists in the malicious DB. Does not create new profiles — so a
 * stray beacon from a legit user never lands in attacker_profiles.
 */
async function recordScreenResolution(attackerIp, screenResolution) {
  if (!attackerIp || !screenResolution) return null;
  try {
    const maliciousConn = connectMaliciousDB();
    if (!maliciousConn?.models?.AttackerProfile) return null;
    const AttackerProfile = maliciousConn.model('AttackerProfile');
    return await AttackerProfile.findOneAndUpdate(
      { ip: attackerIp },
      { $set: { screenResolution, lastSeen: new Date() } },
      { upsert: false, returnDocument: 'after' },
    );
  } catch (err) {
    attackLog.error('TELEMETRY', 'screen_resolution_update_failed', {
      ip: attackerIp,
      error: err.message,
    });
    return null;
  }
}

module.exports = { upsertFromAttack, upsertFromAttackSafe, recordScreenResolution };
