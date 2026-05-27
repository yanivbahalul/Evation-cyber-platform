'use strict';

const honeyToken = require('../traps/honeyToken');
const { getAttackerIp } = require('@evation/shared-utils');
const attackLog = require('../utils/attackLog');

function extractToken(req) {
  const auth = req.headers['authorization'];
  if (auth && /^bearer\s+/i.test(auth)) return auth.replace(/^bearer\s+/i, '').trim();
  if (req.headers['x-api-key']) return req.headers['x-api-key'];
  if (req.query?.apiKey)        return req.query.apiKey;
  if (req.body?.apiKey)         return req.body.apiKey;
  return null;
}

module.exports = async function honeyTokenDetector(req, res, next) {
  try {
    const token = extractToken(req);
    if (!token) return next();
    if (!(await honeyToken.isHoney(token))) return next();

    const ip = getAttackerIp(req);
    await honeyToken.recordUsage(token, { attackerIp: ip, networkContext: 'HTTP' });

    attackLog.info('GATEWAY', 'honey_token_used', {
      trap: 'HONEY_TOKEN',
      trap_label: attackLog.trapLabel('HONEY_TOKEN'),
      ip,
      token_prefix: token.slice(0, 12),
      ...attackLog.requestFields(req),
    });

    req.threatInfo = req.threatInfo || { type: 'HONEY_TOKEN', originIP: ip };
    return next();
  } catch (err) {
    attackLog.error('GATEWAY', 'honey_token_check_failed', { error: err.message, ...attackLog.requestFields(req) });
    return next();
  }
};
