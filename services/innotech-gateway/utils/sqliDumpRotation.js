'use strict';

const COUNTER_TTL_MS = 60 * 60_000;
const byIp = new Map();

setInterval(() => {
  const now = Date.now();
  for (const [ip, data] of byIp) {
    if (now - data.lastSeen > COUNTER_TTL_MS) byIp.delete(ip);
  }
}, 5 * 60_000).unref();

function getIP(req) {
  return (
    req.headers['x-forwarded-for']?.split(',')[0].trim() ||
    req.ip ||
    'unknown'
  );
}

/** Alternate: odd attempts → fake credential dump, even → DB overload error. */
exports.shouldShowCredentialDump = (req) => {
  const ip = getIP(req);
  const state = byIp.get(ip) || { count: 0, lastSeen: 0 };
  state.count += 1;
  state.lastSeen = Date.now();
  byIp.set(ip, state);
  return state.count % 2 === 1;
};

exports.resetForIp = (ip) => byIp.delete(ip);
