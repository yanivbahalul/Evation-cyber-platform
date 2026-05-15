'use strict';

/**
 * Fake Login Trap — fires on BRUTE_FORCE detection.
 * Counts attempts per IP. Attempts 1–9: instant 401. Attempt 10: 10s stall
 * then 423 "locked". Attempts 11+: instant 423.
 */

const TRAP_TYPES = require('../../logging-data-extraction/constants/trapTypes');

const LOCKOUT_AFTER    = 10;
const LOCKOUT_DELAY_MS = 10_000;
const COUNTER_TTL_MS   = 60 * 60_000;

const attempts = new Map();

function getIP(req) {
  return (
    req.threatInfo?.originIP ||
    req.headers['x-forwarded-for']?.split(',')[0].trim() ||
    req.headers['x-real-ip'] ||
    req.ip ||
    req.socket?.remoteAddress ||
    'unknown'
  );
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

// Prune stale entries
setInterval(() => {
  const now = Date.now();
  for (const [ip, data] of attempts) {
    if (now - data.lastSeen > COUNTER_TTL_MS) attempts.delete(ip);
  }
}, 5 * 60_000).unref();

exports.handle = async (req, res, { report } = {}) => {
  const startTime = Date.now();
  const ip        = getIP(req);
  const username  = req.body?.username || req.body?.email || '(missing)';
  const payload   = JSON.stringify({ username, ip });

  const state = attempts.get(ip) || { count: 0, lastSeen: 0, locked: false };
  state.count   += 1;
  state.lastSeen = Date.now();
  attempts.set(ip, state);

  // Already locked → instant
  if (state.locked) {
    res.status(423).json({
      success:    false,
      error:      'Account temporarily locked due to suspicious activity.',
      retryAfter: '24 hours',
    });
    if (report) await report(TRAP_TYPES.BRUTE_FORCE, req, {
      startTime,
      wasted_time_ms: Date.now() - startTime,
      payload,
    });
    return;
  }

  // Lockout attempt (10th) — stall, then lock
  if (state.count >= LOCKOUT_AFTER) {
    state.locked = true;
    attempts.set(ip, state);

    await sleep(LOCKOUT_DELAY_MS);

    res.status(423).json({
      success:           false,
      error:             `Too many failed login attempts for user '${username}'. Account locked for 24 hours.`,
      attemptsRemaining: 0,
    });
    if (report) await report(TRAP_TYPES.BRUTE_FORCE, req, {
      startTime,
      wasted_time_ms: Date.now() - startTime,
      payload,
    });
    return;
  }

  // Regular "wrong password"
  const remaining = LOCKOUT_AFTER - state.count;
  res.status(401).json({
    success:           false,
    error:             'Invalid username or password.',
    attemptsRemaining: remaining,
  });
  if (report) await report(TRAP_TYPES.BRUTE_FORCE, req, {
    startTime,
    wasted_time_ms: Date.now() - startTime,
    payload,
  });
};

exports._internal = { attempts };
