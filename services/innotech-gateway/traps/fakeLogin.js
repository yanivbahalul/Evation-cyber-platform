'use strict';

/**
 * Fake Login Trap — fires on BRUTE_FORCE detection.
 * Counts attempts per IP. Attempts 1–9: instant 401. Attempt 10: 10s stall
 * then 423 "locked". Attempts 11+: instant 423.
 */

const TRAP_TYPES = require('../../logging-data-extraction/constants/trapTypes');
const attackLog = require('../utils/attackLog');

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

async function respond(req, res, status, body, meta) {
  const { startTime, report, payload } = meta;
  const wantsHtml = (req.headers.accept || '').includes('text/html')
    || (req.headers['content-type'] || '').includes('application/x-www-form-urlencoded');

  if (report) {
    await report(TRAP_TYPES.BRUTE_FORCE, req, {
      startTime,
      wasted_time_ms: Date.now() - startTime,
      payload,
    });
  }

  if (wantsHtml) {
    return res.status(status).render('decoy/fake-login', {
      error: body.error || '',
      username: req.body?.username || req.body?.email || '',
      attemptsRemaining: body.attemptsRemaining,
      locked: status === 423,
      withBase: req.withBase || ((p) => p),
    });
  }

  return res.status(status).json(body);
}

exports.handle = async (req, res, { report } = {}) => {
  const startTime = Date.now();
  const ip        = getIP(req);
  const username  = req.body?.username || req.body?.email || '(missing)';
  const payload   = JSON.stringify({ username, ip });
  const meta      = { startTime, report, payload };

  const state = attempts.get(ip) || { count: 0, lastSeen: 0, locked: false };
  state.count   += 1;
  state.lastSeen = Date.now();
  attempts.set(ip, state);

  // Already locked → instant
  if (state.locked) {
    attackLog.warn('TRAP', 'fake_login_account_locked', { trap: TRAP_TYPES.BRUTE_FORCE, ip, username });
    return await respond(req, res, 423, {
      success: false,
      error: 'Account temporarily locked due to suspicious activity.',
      retryAfter: '24 hours',
    }, meta);
  }

  // Lockout attempt (10th) — stall, then lock
  if (state.count >= LOCKOUT_AFTER) {
    state.locked = true;
    attempts.set(ip, state);

    await sleep(LOCKOUT_DELAY_MS);

    attackLog.warn('TRAP', 'fake_login_lockout_after_max_attempts', {
      trap: TRAP_TYPES.BRUTE_FORCE,
      ip,
      username,
      attempts: state.count,
      delay_ms: LOCKOUT_DELAY_MS,
    });

    return await respond(req, res, 423, {
      success: false,
      error: `Too many failed login attempts for user '${username}'. Account locked for 24 hours.`,
      attemptsRemaining: 0,
    }, meta);
  }

  const remaining = LOCKOUT_AFTER - state.count;
  attackLog.info('TRAP', 'fake_login_failed_attempt', {
    trap: TRAP_TYPES.BRUTE_FORCE,
    ip,
    username,
    attempt: state.count,
    attempts_remaining: remaining,
  });
  return await respond(req, res, 401, {
    success: false,
    error: 'Invalid username or password.',
    attemptsRemaining: remaining,
  }, meta);
};

exports._internal = { attempts };
