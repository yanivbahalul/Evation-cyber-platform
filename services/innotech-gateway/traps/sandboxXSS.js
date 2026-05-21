'use strict';

/**
 * Sandbox XSS Trap — fires on XSS detection.
 * Captures the payload for Max's threat intel; renders a "guestbook saved"
 * page: probe-tier payloads are reflected (demo alert); blocked-tier payloads
 * are shown as HTML-encoded plain text only.
 */

const TRAP_TYPES = require('../../logging-data-extraction/constants/trapTypes');
const attackLog = require('../utils/attackLog');
const { classifyXssPayload } = require('../utils/xssPayloadClassifier');

function truncate(s, max = 2000) {
  return s.length > max ? s.slice(0, max) + '…' : s;
}

exports.render = async (req, res, { report } = {}) => {
  const startTime = Date.now();
  const raw   = req.body?.message ?? req.body?.subject ?? req.body?.payload
    ?? req.query?.msg ?? req.query?.message ?? req.query?.payload ?? '';
  const clean = truncate(String(raw));
  const { tier, reason, normalized } = classifyXssPayload(clean);
  const isProbe = tier === 'probe';
  const reportPayload = isProbe ? normalized : `[BLOCKED] ${normalized}`;

  attackLog.info('TRAP', 'xss_sandbox_rendered', {
    trap: TRAP_TYPES.XSS,
    trap_label: attackLog.trapLabel(TRAP_TYPES.XSS),
    xss_tier: tier,
    blocked_reason: reason || undefined,
    payload: attackLog.truncate(reportPayload, 80),
    ...attackLog.requestFields(req),
  });

  res.status(200).render('decoy/sandbox-xss', {
    tier,
    blockedReason: reason || null,
    payload: normalized,
    reflectPayload: isProbe ? normalized : null,
    byteLen: Buffer.byteLength(normalized, 'utf8'),
    savedAt: new Date().toLocaleString(),
    withBase: req.withBase || ((p) => p),
  });

  if (report) {
    await report(TRAP_TYPES.XSS, req, {
      startTime,
      wasted_time_ms: Date.now() - startTime,
      bytes_sent: Buffer.byteLength(normalized),
      payload: reportPayload,
      xssTier: tier,
    });
  }
};
