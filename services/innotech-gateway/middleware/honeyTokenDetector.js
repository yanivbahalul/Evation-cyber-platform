'use strict';

/**
 * Honey-Token Detector
 * Runs after Sagiv's gatekeeper. If an incoming request carries a token
 * that we previously planted, append a triggeredLogs entry on the
 * HoneyToken document. We do NOT reroute the request from here — Sagiv's
 * Gatekeeper remains the sole rerouter to keep the pipeline simple.
 */

const honeyToken = require('../traps/honeyToken');

function extractToken(req) {
  const auth = req.headers['authorization'];
  if (auth && /^bearer\s+/i.test(auth)) return auth.replace(/^bearer\s+/i, '').trim();
  if (req.headers['x-api-key']) return req.headers['x-api-key'];
  if (req.query?.apiKey)        return req.query.apiKey;
  if (req.body?.apiKey)         return req.body.apiKey;
  return null;
}

function getIP(req) {
  return (
    req.headers['x-forwarded-for']?.split(',')[0].trim() ||
    req.headers['x-real-ip'] ||
    req.ip ||
    req.socket?.remoteAddress ||
    'unknown'
  );
}

module.exports = async function honeyTokenDetector(req, res, next) {
  try {
    const token = extractToken(req);
    if (!token) return next();
    if (!(await honeyToken.isHoney(token))) return next();

    const ip = getIP(req);
    console.log(`[HoneyTokenDetector] HIT — ip=${ip} token=${token.slice(0, 12)}...`);
    await honeyToken.recordUsage(token, { attackerIp: ip, networkContext: 'HTTP' });

    // Hint the gatekeeper / decoy for downstream awareness, but let normal
    // routing continue — the bait was the trap; logging it is enough.
    req.threatInfo = req.threatInfo || { type: 'HONEY_TOKEN', originIP: ip };
    return next();
  } catch (err) {
    console.error('[HoneyTokenDetector] error:', err);
    return next();
  }
};
