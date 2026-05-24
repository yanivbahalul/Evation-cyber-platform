'use strict';

const { getAttackerIp } = require('@evation/shared-utils');

const byIp = new Map();
const TTL_MS = 60 * 60_000;

setInterval(() => {
  const now = Date.now();
  for (const [ip, data] of byIp) {
    if (now - data.at > TTL_MS) byIp.delete(ip);
  }
}, 5 * 60_000).unref();

/** Odd attempts → fake dump; even → tarpit error (feels like an overloaded DB). */
exports.shouldShowCredentialDump = (req) => {
  const ip = getAttackerIp(req);
  const prev = byIp.get(ip)?.count || 0;
  const count = prev + 1;
  byIp.set(ip, { count, at: Date.now() });
  return count % 2 === 1;
};
