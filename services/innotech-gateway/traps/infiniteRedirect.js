'use strict';

/**
 * Infinite Redirects Trap — fires on any GET under /internal/archives/* (or
 * the legacy alias /admin/v1/backup/*). Each hit appends another plausible
 * path segment and 302s back to itself, mimicking an infinite directory tree.
 *
 * Defeats automated scrapers/bots that follow every redirect (`curl -L`,
 * crawlers, link spiders) without ever exhausting host resources — we never
 * read or write disk, we just bounce the attacker around.
 *
 * Honest browsers / users that "click through" hit the same trap, but at
 * human speed; humans give up. The redirect chain is logged via the trap
 * reporter on entry, and again every CHECKPOINT_DEPTH hops so the dashboard
 * can show how deep the attacker went.
 */

const TRAP_TYPES = require('@evation/shared-constants');

const SEGMENTS_YEAR  = ['2021', '2022', '2023', '2024', '2025', '2026'];
const SEGMENTS_MONTH = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const SEGMENTS_BUCK  = ['files', 'snapshots', 'rotated', 'incremental', 'full', 'logs', 'archive', 'mirror'];
const SEGMENTS_TAIL  = ['db', 'hr', 'finance', 'mail', 'sap', 'vpn', 'wiki', 'edr', 'srv-01', 'srv-02'];

const POOLS = [SEGMENTS_YEAR, SEGMENTS_MONTH, SEGMENTS_BUCK, SEGMENTS_TAIL];

const MAX_DEPTH        = 20;       // safety cap — beyond this, restart loop
const CHECKPOINT_DEPTH = 5;        // re-report every Nth hop
const SLOW_HEADER_MS   = 1_500;    // gentle slowdown so scrapers feel the cost

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

function pickSegment(depth) {
  const pool = POOLS[depth % POOLS.length];
  return pool[Math.floor(Math.random() * pool.length)];
}

function currentDepth(path) {
  // count slash-separated segments after the trap mount point
  const parts = String(path).split('/').filter(Boolean);
  return parts.length;
}

/**
 * Express handler — call from a wildcard route. Always responds 302.
 */
exports.handle = async (req, res, { report, mountPath = '/internal/archives' } = {}) => {
  const startTime = Date.now();
  const path = req.originalUrl || req.path;
  const depth = currentDepth(path);

  // Soft per-request slowdown — attacker sees "the server is doing work"
  await sleep(SLOW_HEADER_MS);

  // Log on entry and at every CHECKPOINT_DEPTH hop
  if (report && (depth === 1 || depth % CHECKPOINT_DEPTH === 0)) {
    await report(TRAP_TYPES.RECON, req, {
      startTime,
      wasted_time_ms: Date.now() - startTime,
      payload: JSON.stringify({ trap: 'infinite_redirect', depth, path }),
    });
  }

  let nextPath;
  if (depth >= MAX_DEPTH) {
    // Loop back to the root of the trap — chain never terminates, but
    // doesn't grow unbounded in URL length either.
    nextPath = `${mountPath}/${pickSegment(0)}`;
  } else {
    nextPath = `${path.replace(/\/$/, '')}/${pickSegment(depth)}`;
  }

  res.setHeader('Cache-Control', 'no-store');
  return res.redirect(302, nextPath);
};
