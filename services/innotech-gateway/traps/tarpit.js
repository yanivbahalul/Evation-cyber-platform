'use strict';

/**
 * Tarpit ("בור הזפת") — fires on SQLI detection.
 * HTML responses are buffered (single res.send) so they work through the Next.js /gateway proxy.
 */

const TRAP_TYPES = require('@evation/shared-constants');
const { attackLog } = require('@evation/shared-utils');

const isDev = process.env.NODE_ENV !== 'production';
const MIN_HOLD_MS = isDev ? 4_000 : 30_000;
const MAX_HOLD_MS = isDev ? 8_000 : 120_000;
const HEARTBEAT_MS = 400;

const FAKE_ERRORS = [
  'ERROR 1205 (HY000): Lock wait timeout exceeded; try restarting transaction',
  'ERROR 2013 (HY000): Lost connection to MySQL server during query',
  'ERROR 1040 (HY000): Too many connections',
  'ERROR 1114 (HY000): The table \'users\' is full',
  'ERROR 2006 (HY000): MySQL server has gone away',
];

function randomBetween(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function htmlShell(body) {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>InnoTech — Database</title>
<style>
  :root{--bg:#070d10;--text:rgba(255,255,255,.92);--muted:rgba(255,255,255,.55);--primary:#0ea5a5;}
  body{margin:0;min-height:100vh;font-family:ui-sans-serif,system-ui,sans-serif;color:var(--text);
  background:#070d10 radial-gradient(1200px 600px at 20% -10%,rgba(14,165,165,.18),transparent 55%);}
  .wrap{max-width:720px;margin:0 auto;padding:28px 20px}
  .card{border:1px solid rgba(255,255,255,.08);border-radius:14px;background:rgba(255,255,255,.04);padding:20px}
  pre{margin:0;font-family:ui-monospace,monospace;font-size:14px;color:var(--primary);white-space:pre-wrap}
  .meta{margin-top:14px;font-size:12px;color:var(--muted)}
</style></head>
<body><div class="wrap"><div class="card"><div class="meta">INNOTECH · DATABASE SERVICES</div><pre id="out">${body}</pre>
<p class="meta">Internal query interface · hr_finance replica</p></div></div></body></html>`;
}

exports.hold = async (req, res, { report, trapType = TRAP_TYPES.SQLI } = {}) => {
  const startTime = Date.now();
  const holdMs = randomBetween(MIN_HOLD_MS, MAX_HOLD_MS);

  attackLog.info('TRAP', 'tarpit_started', {
    trap: trapType,
    trap_label: attackLog.trapLabel(trapType),
    hold_ms: holdMs,
    ...attackLog.requestFields(req),
  });

  const accept = String(req.headers.accept || '');
  const wantsHtml =
    accept.includes('text/html') ||
    req.method === 'POST' ||
    req.method === 'GET' ||
    (!accept.includes('application/json') && !accept.includes('text/plain'));

  let body = 'Querying database';
  const steps = Math.max(1, Math.floor(holdMs / HEARTBEAT_MS));
  for (let i = 0; i < steps; i++) {
    await sleep(HEARTBEAT_MS);
    body += '.';
  }
  const err = FAKE_ERRORS[randomBetween(0, FAKE_ERRORS.length - 1)];
  body += `\n\n${err}`;

  const wasted = Date.now() - startTime;
  const bytesSent = Buffer.byteLength(wantsHtml ? htmlShell(body) : body, 'utf8');

  attackLog.info('TRAP', 'tarpit_finished', {
    trap: trapType,
    wasted_ms: wasted,
    bytes: bytesSent,
    ...attackLog.requestFields(req),
  });

  if (report) {
    await report(trapType, req, {
      startTime,
      wasted_time_ms: wasted,
      bytes_sent: bytesSent,
    });
  }

  if (res.headersSent) return;

  res.setHeader('X-Powered-By', 'PHP/5.4.16');
  if (wantsHtml) {
    return res.status(200).type('html').send(htmlShell(body));
  }
  return res.status(200).type('text/plain').send(body);
};
