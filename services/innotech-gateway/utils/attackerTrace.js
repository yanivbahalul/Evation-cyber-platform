'use strict';

const { randomUUID } = require('crypto');

const COOKIE_NAME = 'attacker_trace_id';
const MAX_AGE_MS = 1000 * 60 * 60 * 8;

/** Stable cross-trap identifier for correlating AttackEvents in the malicious DB. */
exports.ensureTraceId = (req, res) => {
  let traceId = req.cookies?.[COOKIE_NAME];
  if (!traceId || typeof traceId !== 'string') {
    traceId = randomUUID();
    res.cookie(COOKIE_NAME, traceId, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: MAX_AGE_MS,
    });
  }
  req.traceId = traceId.slice(0, 64);
  return req.traceId;
};

exports.COOKIE_NAME = COOKIE_NAME;
