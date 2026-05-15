'use strict';

/**
 * Sandbox XSS Trap — fires on XSS detection.
 * Captures the payload for Max's threat intel; renders a "guestbook saved"
 * page that displays the payload as HTML-encoded plain text so nothing runs
 * in any viewer's browser.
 */

const TRAP_TYPES = require('../../logging-data-extraction/constants/trapTypes');

function truncate(s, max = 2000) {
  return s.length > max ? s.slice(0, max) + '…' : s;
}

exports.render = async (req, res, { report } = {}) => {
  const startTime = Date.now();
  const raw   = req.body?.payload ?? req.query?.payload ?? '';
  const clean = truncate(String(raw));

  res.status(200).render('decoy/sandbox-xss', {
    payload: clean,
    byteLen: Buffer.byteLength(clean, 'utf8'),
    savedAt: new Date().toLocaleString(),
  });

  if (report) {
    await report(TRAP_TYPES.XSS, req, {
      startTime,
      wasted_time_ms: Date.now() - startTime,
      bytes_sent: Buffer.byteLength(clean),
      payload: clean,
    });
  }
};
