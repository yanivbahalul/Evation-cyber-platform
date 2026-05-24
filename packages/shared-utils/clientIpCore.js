'use strict';

/**
 * Resolve the real client IP behind reverse proxies (Next.js, Nginx, etc.).
 * Skips loopback hops so UI→gateway rewrites do not collapse to 127.0.0.1.
 */

function normalizeIp(raw) {
  if (raw == null || raw === '') return '';
  let ip = String(raw).trim();
  if (!ip) return '';

  // Strip IPv4-mapped IPv6 prefix (::ffff:192.168.0.1)
  if (ip.startsWith('::ffff:')) ip = ip.slice(7);

  // Express / Node may wrap IPv4 in brackets
  if (ip.startsWith('[') && ip.endsWith(']')) ip = ip.slice(1, -1);

  if (ip === '::1') return '127.0.0.1';

  return ip;
}

function isLoopback(ip) {
  const n = normalizeIp(ip);
  if (!n) return false;
  if (n === '127.0.0.1' || n === 'localhost') return true;
  if (n.startsWith('127.')) return true;
  return false;
}

/** RFC1918, link-local, and other non-routable ranges (no MaxMind / geoip-lite city). */
function isPrivateIp(ip) {
  const n = normalizeIp(ip);
  if (!n) return false;
  if (isLoopback(n)) return true;
  if (n.startsWith('10.')) return true;
  if (n.startsWith('192.168.')) return true;
  if (n.startsWith('169.254.')) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(n)) return true;
  if (n.startsWith('fc') || n.startsWith('fd')) return true; // IPv6 ULA
  if (n.startsWith('fe80:')) return true; // IPv6 link-local
  return false;
}

function headerValue(req, name) {
  const headers = req?.headers;
  if (!headers) return '';
  const lower = name.toLowerCase();
  if (typeof headers.get === 'function') {
    return headers.get(lower) || headers.get(name) || '';
  }
  const direct = headers[lower] ?? headers[name];
  if (Array.isArray(direct)) return direct[0] || '';
  return direct ? String(direct) : '';
}

function parseForwardedChain(value) {
  if (!value) return [];
  return String(value)
    .split(',')
    .map((part) => normalizeIp(part.trim()))
    .filter(Boolean);
}

function isTrustedLocalProxy(req) {
  const peer = normalizeIp(req?.socket?.remoteAddress) || normalizeIp(req?.ip);
  return isLoopback(peer);
}

/**
 * @param {import('http').IncomingMessage & { threatInfo?: { originIP?: string }, ip?: string }} req
 * @returns {string}
 */
function resolveAttackerIp(req) {
  const candidates = [];

  const fromThreat = normalizeIp(req?.threatInfo?.originIP);
  if (fromThreat) candidates.push(fromThreat);

  // Set by admin-panel middleware when Next proxies /gateway → gateway (trusted local hop only)
  if (isTrustedLocalProxy(req)) {
    const fromClientHeader = normalizeIp(headerValue(req, 'x-client-ip'));
    if (fromClientHeader) candidates.push(fromClientHeader);
  }

  candidates.push(
    ...parseForwardedChain(headerValue(req, 'x-forwarded-for')),
    normalizeIp(headerValue(req, 'x-real-ip')),
    normalizeIp(headerValue(req, 'cf-connecting-ip')),
    normalizeIp(req?.socket?.remoteAddress),
    normalizeIp(req?.ip),
  );

  for (const ip of candidates) {
    if (ip && !isLoopback(ip)) return ip;
  }

  const fallback = candidates.find(Boolean);
  return fallback || 'unknown';
}

module.exports = {
  normalizeIp,
  isLoopback,
  isPrivateIp,
  parseForwardedChain,
  resolveAttackerIp,
  isTrustedLocalProxy,
};
