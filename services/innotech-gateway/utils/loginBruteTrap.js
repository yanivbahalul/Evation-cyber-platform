'use strict';

const attackLog = require('./attackLog');

const COUNTER_TTL_MS = 60 * 60_000;
const TRIGGER_AFTER = 5;

const failedByIp = new Map();

setInterval(() => {
  const now = Date.now();
  for (const [ip, data] of failedByIp) {
    if (now - data.lastSeen > COUNTER_TTL_MS) failedByIp.delete(ip);
  }
}, 5 * 60_000).unref();

function getIP(req) {
  return (
    req.headers['x-forwarded-for']?.split(',')[0].trim() ||
    req.ip ||
    'unknown'
  );
}

/** @returns {boolean} true when attacker should be handed to the fake login trap */
exports.shouldHandoffToDecoyLogin = (req) => {
  const ip = getIP(req);
  const state = failedByIp.get(ip) || { count: 0, lastSeen: 0 };
  state.count += 1;
  state.lastSeen = Date.now();
  failedByIp.set(ip, state);
  const handoff = state.count >= TRIGGER_AFTER;
  if (handoff) {
    attackLog.warn('GATEWAY', 'brute_force_redirect_to_fake_login', {
      trap: 'BRUTE_FORCE',
      trap_label: attackLog.trapLabel('BRUTE_FORCE'),
      ip,
      failed_attempts: state.count,
    });
  }
  return handoff;
};

exports.resetForIp = (ip) => failedByIp.delete(ip);

/** Successful password on the real HR login — do not keep brute counter for this IP. */
exports.recordSuccess = (req) => {
  failedByIp.delete(getIP(req));
};
