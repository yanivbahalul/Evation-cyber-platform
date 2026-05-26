'use strict';

/**
 * Resolve the real client IP behind reverse proxies (Next.js, Nginx, etc.).
 * Prefers the first non-loopback address in the trusted chain (LAN / public).
 * Falls back to 127.0.0.1 only for same-machine dev (x-client-ip or local proxy hop).
 * Returns "unknown" when there is no IP signal at all.
 */

function normalizeIp(raw) {
  if (raw == null || raw === '') return '';
  let ip = String(raw).trim();
  if (!ip) return '';

  // Strip IPv4-mapped IPv6 prefix (::ffff:192.168.0.1)
  if (ip.startsWith('::ffff:')) ip = ip.slice(7);

  // Express / Node may wrap IPv4 in brackets
  if (ip.startsWith('[') && ip.endsWith(']')) ip = ip.slice(1, -1);

  // Strip IPv4 port suffix (192.168.0.1:12345)
  const v4Port = ip.match(/^(\d{1,3}(?:\.\d{1,3}){3}):\d+$/);
  if (v4Port) ip = v4Port[1];

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

function parseTrustedProxyList() {
  const raw = process.env.TRUSTED_PROXY_IPS;
  if (!raw || !String(raw).trim()) return [];
  return String(raw)
    .split(',')
    .map((part) => normalizeIp(part.trim()))
    .filter(Boolean);
}

/** True when the immediate TCP peer is a known reverse proxy (loopback or TRUSTED_PROXY_IPS). */
function isTrustedProxy(req) {
  if (isTrustedLocalProxy(req)) return true;
  const peer = normalizeIp(req?.socket?.remoteAddress) || normalizeIp(req?.ip);
  if (!peer) return false;
  const trusted = parseTrustedProxyList();
  return trusted.some((t) => peer === t || (t.endsWith('.') && peer.startsWith(t)));
}

/**
 * @param {import('http').IncomingMessage & { threatInfo?: { originIP?: string }, ip?: string }} req
 * @returns {string}
 */
function firstLoopback(candidates) {
  for (const ip of candidates) {
    if (ip && isLoopback(ip)) return ip;
  }
  return '';
}

function resolveAttackerIp(req) {
  const candidates = [];
  let stampedClientIp = '';

  // Set by admin-panel middleware when Next proxies /gateway → gateway (trusted local hop only)
  if (isTrustedLocalProxy(req)) {
    stampedClientIp = normalizeIp(headerValue(req, 'x-client-ip'));
    if (stampedClientIp) candidates.push(stampedClientIp);
  }

  if (isTrustedProxy(req)) {
    candidates.push(
      ...parseForwardedChain(headerValue(req, 'x-forwarded-for')),
      normalizeIp(headerValue(req, 'x-real-ip')),
      normalizeIp(headerValue(req, 'cf-connecting-ip')),
    );
  }

  candidates.push(
    normalizeIp(req?.socket?.remoteAddress),
    normalizeIp(req?.ip),
  );

  for (const ip of candidates) {
    if (ip && !isLoopback(ip)) return ip;
  }

  // Same-machine dev: middleware stamped loopback, or only a local proxy hop (Next → gateway).
  if (stampedClientIp && isLoopback(stampedClientIp)) {
    return stampedClientIp;
  }

  if (isTrustedLocalProxy(req)) {
    const localOnly = firstLoopback(candidates);
    if (localOnly) return localOnly;
  }

  return 'unknown';
}

module.exports = {
  normalizeIp,
  isLoopback,
  isPrivateIp,
  parseForwardedChain,
  resolveAttackerIp,
  isTrustedLocalProxy,
  isTrustedProxy,
};
