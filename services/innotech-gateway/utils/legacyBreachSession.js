'use strict';

const COOKIE_NAME = 'legacy_admin_sess';
const MAX_AGE_MS = 1000 * 60 * 60 * 8;

/** Fake “successful” legacy admin session after brute-force handoff (honeypot only). */
exports.establishBreachSession = (res, { username = 'administrator' } = {}) => {
  const name = String(username || 'administrator').trim().slice(0, 64) || 'administrator';
  res.cookie(COOKIE_NAME, name, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: MAX_AGE_MS,
  });
  return name;
};

exports.readBreachUser = (req) => {
  const raw = req.cookies?.[COOKIE_NAME];
  if (!raw || typeof raw !== 'string') return null;
  const username = raw.trim().slice(0, 64);
  if (!username) return null;
  return { username, role: 'administrator' };
};

exports.clearBreachSession = (res) => {
  res.clearCookie(COOKIE_NAME, { path: '/' });
};
