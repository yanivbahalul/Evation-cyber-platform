'use strict';

const { getAttackerIp, attackLog } = require('@evation/shared-utils');

const COUNTER_TTL_MS = 60 * 60_000;
const MIN_TRIGGER_AFTER = 5;
const MAX_TRIGGER_AFTER = 10;

const failedByIp = new Map();

setInterval(() => {
  const now = Date.now();
  for (const [ip, data] of failedByIp) {
    if (now - data.lastSeen > COUNTER_TTL_MS) failedByIp.delete(ip);
  }
}, 5 * 60_000).unref();

function getKey(req) {
  // Prefer the stable attacker trace cookie (works even behind proxies / Next rewrites).
  // Fallback to IP if trace isn't available for any reason.
  return (req.traceId && typeof req.traceId === 'string' && req.traceId.trim())
    ? `trace:${req.traceId.trim()}`
    : `ip:${getAttackerIp(req)}`;
}

function pickThreshold() {
  const span = MAX_TRIGGER_AFTER - MIN_TRIGGER_AFTER + 1;
  return MIN_TRIGGER_AFTER + Math.floor(Math.random() * span);
}

/** @returns {boolean} true when attacker should be handed to the fake login trap */
exports.shouldHandoffToDecoyLogin = (req) => {
  const key = getKey(req);
  const ip = getAttackerIp(req);
  const state = failedByIp.get(key) || { count: 0, lastSeen: 0, threshold: pickThreshold() };
  state.count += 1;
  state.lastSeen = Date.now();
  failedByIp.set(key, state);
  const handoff = state.count >= state.threshold;
  if (handoff) {
    attackLog.warn('GATEWAY', 'brute_force_redirect_to_fake_login', {
      trap: 'BRUTE_FORCE',
      trap_label: attackLog.trapLabel('BRUTE_FORCE'),
      ip,
      failed_attempts: state.count,
      trigger_after: state.threshold,
    });
    // Reset after handoff so the attacker can't immediately re-trigger on the next bad password.
    failedByIp.delete(key);
  }
  return handoff;
};

exports.resetForIp = (ip) => failedByIp.delete(ip);

/** Successful password on the real HR login — do not keep brute counter for this IP. */
exports.recordSuccess = (req) => {
  failedByIp.delete(getKey(req));
};
