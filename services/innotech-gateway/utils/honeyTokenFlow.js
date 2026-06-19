'use strict';

const { COOKIE_NAME } = require('./attackerTrace');

/** Match attacker_trace_id cookie maxAge (8h). */
const TRACE_TTL_MS = 8 * 60 * 60 * 1000;

/** traceId → first token_used report timestamp (in-process dedup). */
const tokenUsedByTrace = new Map();

function queryTokenAck(req) {
  const q = req.query?.token_ack;
  if (q === '1' || q === 1) return true;
  if (Array.isArray(q) && q.some((v) => String(v) === '1')) return true;
  return false;
}

/** True when the console has already acknowledged this honey token. */
function isHoneyTokenAcknowledged(req) {
  if (queryTokenAck(req)) return true;
  const url = String(req.originalUrl || req.url || '');
  return /(?:^|[?&])token_ack=1(?:&|$|[#])/.test(url);
}

function traceId(req) {
  return req.traceId || req.cookies?.[COOKIE_NAME] || null;
}

function shouldReportTokenUsed(req) {
  const id = traceId(req);
  if (!id) return true;
  const at = tokenUsedByTrace.get(id);
  return at == null || Date.now() - at >= TRACE_TTL_MS;
}

function markTokenUsedReported(req) {
  const id = traceId(req);
  if (!id) return;
  tokenUsedByTrace.set(id, Date.now());
  if (tokenUsedByTrace.size > 5000) {
    const cutoff = Date.now() - TRACE_TTL_MS;
    for (const [k, t] of tokenUsedByTrace) {
      if (t < cutoff) tokenUsedByTrace.delete(k);
    }
  }
}

/**
 * Extract a presented credential from a request the way a real API client would
 * send it: Authorization: Bearer, X-API-Key, or apiKey in query/body.
 */
function extractPresentedToken(req) {
  const auth = req.headers?.['authorization'];
  if (auth && /^bearer\s+/i.test(auth)) return auth.replace(/^bearer\s+/i, '').trim();
  if (req.headers?.['x-api-key']) return String(req.headers['x-api-key']).trim();
  if (req.headers?.['x-aws-access-key-id']) return String(req.headers['x-aws-access-key-id']).trim();
  if (req.query?.apiKey) return String(req.query.apiKey).trim();
  if (req.body?.apiKey) return String(req.body.apiKey).trim();
  return null;
}

// ── Realistic per-token rate limiting (simulates a real API quota) ───────────
const RATE_LIMIT = 20; // requests per window
const RATE_WINDOW_MS = 60 * 1000;
const rateByToken = new Map(); // value → { count, windowStart }

/**
 * Consume one request from a token's quota.
 * @returns {{limited:boolean, limit:number, remaining:number, retryAfterSec:number}}
 */
function consumeRate(value) {
  const now = Date.now();
  let state = rateByToken.get(value);
  if (!state || now - state.windowStart >= RATE_WINDOW_MS) {
    state = { count: 0, windowStart: now, notifiedLimit: false };
    rateByToken.set(value, state);
  }
  state.count += 1;
  const remaining = Math.max(0, RATE_LIMIT - state.count);
  const limited = state.count > RATE_LIMIT;
  // First time we cross the limit in this window — used to log a single 429 event
  // instead of one per hammered request (anti-spam).
  const firstLimited = limited && !state.notifiedLimit;
  if (firstLimited) state.notifiedLimit = true;
  const retryAfterSec = Math.max(1, Math.ceil((state.windowStart + RATE_WINDOW_MS - now) / 1000));
  if (rateByToken.size > 5000) {
    for (const [k, s] of rateByToken) {
      if (now - s.windowStart >= RATE_WINDOW_MS) rateByToken.delete(k);
    }
  }
  return { limited, firstLimited, limit: RATE_LIMIT, remaining, retryAfterSec };
}

module.exports = {
  isHoneyTokenAcknowledged,
  shouldReportTokenUsed,
  markTokenUsedReported,
  extractPresentedToken,
  consumeRate,
};
