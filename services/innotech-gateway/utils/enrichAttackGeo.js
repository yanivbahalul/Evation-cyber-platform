'use strict';

const { resolveIpGeoFast } = require('../../logging-data-extraction/services/geoService');
const attackLog = require('./attackLog');

/**
 * Attach city / lat / lng to trap payloads before telemetry or live alerts.
 * Runs in the gateway process (LAN egress is warmed on gateway boot).
 */
function enrichAttackGeo(trapData) {
  const ip = trapData?.attackerIp;
  if (!ip) return trapData;

  try {
    const geo = resolveIpGeoFast(ip);
    if (!geo?.city || geo.city === 'Unknown') return trapData;

    return {
      ...trapData,
      city: geo.city,
      lat: geo.lat ?? trapData.lat ?? 0,
      lng: geo.lng ?? trapData.lng ?? 0,
    };
  } catch (err) {
    attackLog.warn('TRAP', 'geo_enrich_failed', {
      ip,
      trap: trapData?.trapType,
      error: err?.message || String(err),
    });
    return trapData;
  }
}

module.exports = { enrichAttackGeo };
