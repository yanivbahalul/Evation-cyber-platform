'use strict';

/**
 * Tarpit ("בור הזפת") — fires on SQLI detection.
 * Keeps the attacker's HTTP socket open for 30–120s, trickling fake DB
 * "Querying..." dots, then sends a believable MySQL error and closes.
 * Non-blocking: setTimeout + Promise + AbortController.
 */

const TRAP_TYPES = require('../../logging-data-extraction/constants/trapTypes');

// Tunables
const MIN_HOLD_MS  = 30_000;
const MAX_HOLD_MS  = 120_000;
const HEARTBEAT_MS = 4_000;

const FAKE_ERRORS = [
  "ERROR 1205 (HY000): Lock wait timeout exceeded; try restarting transaction",
  "ERROR 2013 (HY000): Lost connection to MySQL server during query",
  "ERROR 1040 (HY000): Too many connections",
  "ERROR 1114 (HY000): The table 'users' is full",
  "ERROR 2006 (HY000): MySQL server has gone away",
];

function randomBetween(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function sleep(ms, abortSignal) {
  return new Promise((resolve) => {
    const t = setTimeout(resolve, ms);
    abortSignal?.addEventListener('abort', () => {
      clearTimeout(t);
      resolve();
    }, { once: true });
  });
}

exports.hold = async (req, res, { report } = {}) => {
  const startTime = Date.now();
  const holdMs    = randomBetween(MIN_HOLD_MS, MAX_HOLD_MS);
  let   bytesSent = 0;

  const ac = new AbortController();
  req.on('close', () => ac.abort());

  res.status(200);
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('X-Powered-By', 'PHP/5.4.16'); // bait
  res.flushHeaders?.();
  const initial = 'Querying database';
  try { res.write(initial); bytesSent += Buffer.byteLength(initial); } catch { /* ignore */ }

  const deadline = startTime + holdMs;
  while (Date.now() < deadline && !ac.signal.aborted) {
    const remaining = deadline - Date.now();
    await sleep(Math.min(HEARTBEAT_MS, remaining), ac.signal);
    if (ac.signal.aborted) break;
    try { res.write('.'); bytesSent += 1; } catch { break; }
  }

  if (!ac.signal.aborted && !res.writableEnded) {
    const err = FAKE_ERRORS[randomBetween(0, FAKE_ERRORS.length - 1)];
    const tail = `\n\n${err}\n`;
    try { res.write(tail); bytesSent += Buffer.byteLength(tail); res.end(); }
    catch { /* socket already closed */ }
  }

  // Final report — overrides the entry-time one with accurate stats
  if (report) {
    await report(TRAP_TYPES.SQLI, req, {
      startTime,
      wasted_time_ms: Date.now() - startTime,
      bytes_sent: bytesSent,
    });
  }
};
