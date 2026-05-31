'use strict';

/**
 * Fake Login Trap — fires on BRUTE_FORCE detection.
 *
 * Counts attempts per IP:
 *   - 1–9:   401 "Invalid credentials" (every 5th attempt is extra slow with
 *            a "system unstable" hint, per Requirements §Brute Force).
 *   - 10+:   establishes a fake admin session and redirects the attacker into
 *            the Faker honeypot dashboard. Every action there is logged but
 *            inert. After GRANT_TTL_MS (or LOGOUT_ATTEMPTS post-grant) the
 *            counter resets so the same IP keeps cycling through the trap.
 */

const TRAP_TYPES = require('@evation/shared-constants');
const { getAttackerIp, attackLog } = require('@evation/shared-utils');
const legacyBreachSession = require('../utils/legacyBreachSession');
const { PATHS: DP } = require('../config/deceptionPaths');

const GRANT_ON       = 10;
const SUSPICIOUS_ON  = 5;
const SUSPICIOUS_MS  = 4_000;
const COUNTER_TTL_MS = 60 * 60_000;

const attempts = new Map();

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

setInterval(() => {
  const now = Date.now();
  for (const [ip, data] of attempts) {
    if (now - data.lastSeen > COUNTER_TTL_MS) attempts.delete(ip);
  }
}, 5 * 60_000).unref();

async function respondFail(req, res, status, body, meta) {
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
      locked: false,
      withBase: req.withBase || ((p) => p),
    });
  }

  return res.status(status).json(body);
}

exports.handle = async (req, res, { report } = {}) => {
  const startTime = Date.now();
  const ip        = getAttackerIp(req);
  const username  = req.body?.username || req.body?.email || '(missing)';
  const payload   = JSON.stringify({ username, ip });
  const meta      = { startTime, report, payload };

  const state = attempts.get(ip) || { count: 0, lastSeen: 0 };
  state.count   += 1;
  state.lastSeen = Date.now();
  attempts.set(ip, state);

  // Grant fake admin dashboard on the GRANT_ON-th attempt (per Requirements
  // doc — "the system lets him in even if the password is wrong on the 10th
  // attempt"). Every button in the resulting fake dashboard is inert and
  // logged via the existing decoy controller.
  if (state.count >= GRANT_ON) {
    attempts.delete(ip);

    legacyBreachSession.establishBreachSession(res, { username: username || 'administrator' });

    attackLog.warn('TRAP', 'fake_login_granted_after_brute_force', {
      trap: TRAP_TYPES.BRUTE_FORCE,
      ip,
      username,
      attempts: state.count,
    });

    if (report) {
      await report(TRAP_TYPES.BRUTE_FORCE, req, {
        startTime,
        wasted_time_ms: Date.now() - startTime,
        payload: JSON.stringify({ outcome: 'brute_force_granted', username, attempts: state.count }),
      });
    }

    const target = (req.withBase || ((p) => p))(`${DP.console}?breach=legacy`);
    return res.redirect(302, target);
  }

  // Every 5th attempt: artificial slow-down + "system unstable" hint so the
  // attacker feels they're "almost there" and keeps trying.
  if (state.count % SUSPICIOUS_ON === 0) {
    await sleep(SUSPICIOUS_MS);
    return await respondFail(req, res, 401, {
      success: false,
      error: 'Authentication service is under heavy load. Please retry.',
      attemptsRemaining: GRANT_ON - state.count,
    }, meta);
  }

  const remaining = GRANT_ON - state.count;
  attackLog.info('TRAP', 'fake_login_failed_attempt', {
    trap: TRAP_TYPES.BRUTE_FORCE,
    ip,
    username,
    attempt: state.count,
    attempts_remaining: remaining,
  });
  return await respondFail(req, res, 401, {
    success: false,
    error: 'Invalid username or password.',
    attemptsRemaining: remaining,
  }, meta);
};

exports._internal = { attempts };
