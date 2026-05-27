/**
 * Read-only Malicious DB connection for IP ban enforcement at the gateway.
 */
const mongoose = require('mongoose');
const { AttackerProfileSchema } = require('@evation/db-schemas');

const REFRESH_MS = 15_000;
let conn = null;
let AttackerProfile = null;
let bannedSet = new Set();
let refreshTimer = null;

function getMaliciousUri() {
  return process.env.MALICIOUS_DB_URI || '';
}

async function ensureConnection() {
  const uri = getMaliciousUri();
  if (!uri) return false;

  if (conn && conn.readyState === 1) return true;

  if (!conn) {
    conn = mongoose.createConnection(uri, {
      serverSelectionTimeoutMS: 8000,
      connectTimeoutMS: 8000,
      bufferCommands: false,
    });
    AttackerProfile = conn.model('AttackerProfile', AttackerProfileSchema);
  }

  if (conn.readyState !== 1) {
    await conn.asPromise();
  }
  return true;
}

async function refreshBannedSet() {
  try {
    const ok = await ensureConnection();
    if (!ok) return;
    const rows = await AttackerProfile.find({ banned: true }).select('ip').lean();
    bannedSet = new Set(rows.map((r) => String(r.ip)));
  } catch (err) {
    console.error('[banService] refresh failed', err.message);
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
exports.refreshBannedSet = refreshBannedSet;
