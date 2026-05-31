'use strict';

/**
 * HTTP Trickle Trap — fires for IPs that have been positively identified as
 * attackers (currently: present in banService's banned set). Per Requirements
 * §"HTTP Trait":
 *
 *   "When the system identifies an attacker with certainty, subsequent
 *    requests will be answered slowly — the server sends one byte every
 *    10 seconds, keeping the connection open and preventing fast scanning."
 *
 * Sends Content-Type: text/plain (no Content-Length so we can stream
 * indefinitely with chunked transfer). Writes one ASCII byte every
 * TRICKLE_INTERVAL_MS until either:
 *   - MAX_BYTES is reached (defensive cap), or
 *   - the client disconnects, or
 *   - HARD_MAX_MS elapses.
 *
 * No buffering of host RAM — each byte is written and flushed.
 */

const TRAP_TYPES = require('@evation/shared-constants');
const { attackLog } = require('@evation/shared-utils');

const TRICKLE_INTERVAL_MS = 10_000;
const MAX_BYTES           = 600;
const HARD_MAX_MS         = 60 * 60_000;

const FILLER = 'InnoTech HR replica — establishing secure tunnel, please wait while we authorise your session... ';

exports.stream = async (req, res, { report } = {}) => {
  const startTime = Date.now();
  let bytesSent = 0;
  let closed = false;
  let timer = null;

  res.status(200);
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  attackLog.warn('TRAP', 'http_trickle_started', {
    trap: TRAP_TYPES.DATA_BOMB,
    ip: req.ip,
    ...attackLog.requestFields(req),
  });

  const finish = async (reason) => {
    if (closed) return;
    closed = true;
    if (timer) clearTimeout(timer);
    const wasted = Date.now() - startTime;
    try { res.end(); } catch { /* ignore */ }

    attackLog.info('TRAP', 'http_trickle_finished', {
      trap: TRAP_TYPES.DATA_BOMB,
      ip: req.ip,
      reason,
      wasted_ms: wasted,
      bytes_sent: bytesSent,
    });

    if (report) {
      await report(TRAP_TYPES.DATA_BOMB, req, {
        startTime,
        wasted_time_ms: wasted,
        bytes_sent: bytesSent,
        payload: JSON.stringify({ trap: 'http_trickle', reason, bytes: bytesSent }),
      });
    }
  };

  req.on('close', () => finish('client_disconnected'));
  req.on('aborted', () => finish('client_aborted'));

  const writeOne = () => {
    if (closed) return;
    if (bytesSent >= MAX_BYTES) return finish('max_bytes');
    if (Date.now() - startTime >= HARD_MAX_MS) return finish('hard_max_ms');

    const ch = FILLER.charAt(bytesSent % FILLER.length);
    try {
      res.write(ch);
    } catch {
      return finish('write_error');
    }
    bytesSent += 1;
    timer = setTimeout(writeOne, TRICKLE_INTERVAL_MS);
    if (typeof timer.unref === 'function') timer.unref();
  };

  // First byte immediately so attacker sees "something happening"
  writeOne();
};
