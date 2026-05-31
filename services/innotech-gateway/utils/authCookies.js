'use strict';

const {
  authCookieMaxAgeSeconds,
  authJwtExpiresIn,
  CLEAR_AUTH_COOKIE_NAMES,
} = require('@evation/shared-utils');

function authCookieOptions(sameSite = 'lax') {
  const maxAgeSec = authCookieMaxAgeSeconds();
  const base = {
    httpOnly: true,
    sameSite,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
  };
  if (maxAgeSec == null) return base;
  return { ...base, maxAge: maxAgeSec * 1000 };
}

/** Wipe portal / gateway / honeypot session cookies before a new sign-in. */
function clearAllAuthCookies(res) {
  for (const name of CLEAR_AUTH_COOKIE_NAMES) {
    const sameSite =
      name === 'auth' || name === 'preauth' || name === 'legacy_admin_sess' ? 'lax' : 'strict';
    res.cookie(name, '', { ...authCookieOptions(sameSite), maxAge: 0 });
  }
}

module.exports = {
  authCookieMaxAgeSeconds,
  authJwtExpiresIn,
  authCookieOptions,
  clearAllAuthCookies,
};
