'use strict';

const connectMaliciousDB = require('../config/maliciousDb');
const { attackLog } = require('@evation/shared-utils');
const { resolveIpGeo, hasValidCoords } = require('./geoService');

function geoFromAttackData(attackData) {
  const city = attackData?.city;
  if (!city || city === 'Unknown' || city === '—') return null;
  return {
    city,
    country: attackData.country,
    countryCode: attackData.countryCode,
    lat: attackData.lat ?? null,
    lng: attackData.lng ?? null,
    isp: attackData.isp,
    source: attackData.geoSource,
    precision: attackData.geoPrecision,
  };
}

function applyGeoFields($set, geo) {
  $set.city = geo.city;
  if (geo.country) $set.country = geo.country;
  if (geo.countryCode) $set.countryCode = geo.countryCode;
  if (geo.source) $set.geoSource = geo.source;
  if (geo.precision) $set.geoPrecision = geo.precision;
  if (geo.isp) $set.isp = geo.isp;

  if (hasValidCoords(geo.lat, geo.lng)) {
    $set.lat = geo.lat;
    $set.lng = geo.lng;
  } else {
    $set.lat = null;
    $set.lng = null;
  }
}

/**
 * Upsert attacker profile from a trap payload received at /internal/attack.
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
    os: fp.os,
    platform: fp.platform,
    browser: fp.browserVersion || fp.browser,
    deviceType: fp.deviceType,
    isBot: !!fp.isBot,
  };
  applyGeoFields($set, geo);
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

/**
 * Return the set of currently banned attacker IPs. The gateway polls this so it
 * never needs its own malicious-DB connection for ban enforcement.
 */
async function getBannedIps() {
  const maliciousConn = connectMaliciousDB();
  if (!maliciousConn?.models?.AttackerProfile) return [];
  const rows = await maliciousConn
    .model('AttackerProfile')
    .find({ banned: true })
    .select('ip')
    .lean();
  return rows.map((r) => String(r.ip));
}

module.exports = { upsertFromAttack, upsertFromAttackSafe, recordScreenResolution, getBannedIps };
