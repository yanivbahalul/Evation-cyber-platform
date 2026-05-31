/**
 * IP ban enforcement at the gateway. The banned-IP set is owned by the telemetry
 * service (which owns the malicious DB); the gateway polls it and caches locally.
 */
const { attackLog } = require('@evation/shared-utils');
const { fetchBannedIps } = require('../utils/telemetryClient');

const REFRESH_MS = 15_000;
let bannedSet = new Set();
let refreshTimer = null;

async function refreshBannedSet() {
  try {
    const ips = await fetchBannedIps();
    bannedSet = new Set(ips.map((ip) => String(ip)));
  } catch (err) {
    attackLog.warn('GATEWAY', 'ban_refresh_failed', { error: err.message });
  }
}

function startBanRefreshLoop() {
  if (refreshTimer) return;
  refreshBannedSet();
  refreshTimer = setInterval(refreshBannedSet, REFRESH_MS);
  if (typeof refreshTimer.unref === 'function') refreshTimer.unref();
}

exports.isBlacklisted = (ip) => {
  if (!ip) return false;
  return bannedSet.has(String(ip));
};

exports.startBanRefreshLoop = startBanRefreshLoop;
