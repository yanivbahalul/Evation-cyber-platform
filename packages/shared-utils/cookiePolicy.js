'use strict';

/**
 * Auth cookie lifetime. Default: session cookie in non-production (browser close),
 * 8h in production. Override with AUTH_COOKIE_MAX_AGE_SECONDS (seconds) or "session".
 */
function authCookieMaxAgeSeconds() {
  const raw = process.env.AUTH_COOKIE_MAX_AGE_SECONDS;
  if (raw === undefined || raw === null) {
    return process.env.NODE_ENV === 'production' ? 60 * 60 * 8 : undefined;
  }
  const trimmed = String(raw).trim().toLowerCase();
  if (trimmed === '' || trimmed === 'session' || trimmed === '0') return undefined;
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return Math.floor(n);
}

/** JWT `expiresIn` aligned with auth cookies. */
function authJwtExpiresIn() {
  const sec = authCookieMaxAgeSeconds();
  if (sec == null) {
    return process.env.NODE_ENV === 'production' ? '8h' : '4h';
  }
  return `${Math.max(sec, 60 * 15)}s`;
}

function pre2faMaxAgeSeconds() {
  return 60 * 5;
}

/** Cookie names cleared on login / logout. */
const CLEAR_AUTH_COOKIE_NAMES = ['admin_auth', 'auth', 'pre_2fa', 'preauth', 'legacy_admin_sess'];

module.exports = {
  authCookieMaxAgeSeconds,
  authJwtExpiresIn,
  pre2faMaxAgeSeconds,
  CLEAR_AUTH_COOKIE_NAMES,
};
