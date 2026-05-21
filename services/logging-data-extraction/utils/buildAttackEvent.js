'use strict';

/**
 * Normalize gateway / telemetry trap payloads into AttackEvent document fields.
 */
function buildAttackEvent(attackData) {
  const {
    attackerIp,
    trapType,
    payload,
    wasted_time_ms = 0,
    bytes_sent = 0,
    traceId,
    method,
    path,
    userAgent,
    referer,
    fingerprint = {},
    handoffFrom,
    xssTier,
    secondaryTraps,
  } = attackData;

  return {
    attackerIp,
    trapType,
    payload: typeof payload === 'string' ? payload : JSON.stringify(payload ?? {}),
    wasted_time_ms,
    bytes_sent,
    traceId: traceId || undefined,
    method: method || undefined,
    path: path || undefined,
    userAgent: userAgent || undefined,
    referer: referer || undefined,
    fingerprint: Object.keys(fingerprint).length ? fingerprint : undefined,
    handoffFrom: handoffFrom || undefined,
    xssTier: xssTier || undefined,
    secondaryTraps: Array.isArray(secondaryTraps) && secondaryTraps.length ? secondaryTraps : undefined,
  };
}

module.exports = { buildAttackEvent };
