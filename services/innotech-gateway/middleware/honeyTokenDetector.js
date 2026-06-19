'use strict';

const honeyToken = require('../traps/honeyToken');
const { extractPresentedToken } = require('../utils/honeyTokenFlow');
const { getAttackerIp, attackLog } = require('@evation/shared-utils');

/**
 * Detects planted honey-token credentials on any request and attaches the
 * resolved provenance to req.honeyToken. Forensic usage is recorded later by
 * the handler that knows the HTTP outcome (200/302/401/403/429), so the SOC
 * sees exactly how each stolen credential behaved.
 */
module.exports = async function honeyTokenDetector(req, res, next) {
  try {
    const token = extractPresentedToken(req);
    if (!token) return next();

    const entry = await honeyToken.resolve(token);
    if (!entry) return next();

    const ip = getAttackerIp(req);
    req.honeyToken = { ...entry, presented: token };

    attackLog.info('GATEWAY', 'honey_token_detected', {
      trap: 'HONEY_TOKEN',
      trap_label: attackLog.trapLabel('HONEY_TOKEN'),
      ip,
      service: entry.service,
      token_type: entry.tokenType,
      leak_source: entry.leakSource,
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
