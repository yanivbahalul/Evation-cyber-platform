'use strict';

const attackLog = require('./attackLog');
const { enrichAttackGeo } = require('./enrichAttackGeo');

const LIVE_ALERT_TIMEOUT_MS = 5000;

/**
 * @param {object} trapData
 * @returns {Promise<{ status: 'sent' | 'skipped' | 'failed', reason?: string }>}
 */
async function emitLiveAlert(trapData) {
  const enriched = await enrichAttackGeo(trapData);

  const base =
    process.env.TELEMETRY_URL ||
    process.env.NEXT_PUBLIC_TELEMETRY_SOCKET_URL ||
    'http://localhost:3002';
  const token = process.env.ADMIN_SOCKET_TOKEN;
  if (!token) {
    attackLog.warn('TRAP', 'live_alert_skipped_no_token', { trap: enriched?.trapType });
    return { status: 'skipped', reason: 'no_token' };
  }

  const url = `${String(base).replace(/\/$/, '')}/internal/live-alert`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(enriched),
      signal: AbortSignal.timeout(LIVE_ALERT_TIMEOUT_MS),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      return {
        status: 'failed',
        reason: `telemetry HTTP ${res.status}: ${body.slice(0, 200)}`,
      };
    }

    return { status: 'sent' };
  } catch (err) {
    const reason = err?.message || String(err);
    if (err?.name === 'TimeoutError' || err?.name === 'AbortError') {
      attackLog.warn('TRAP', 'live_alert_timeout', { trap: enriched?.trapType, ms: LIVE_ALERT_TIMEOUT_MS });
      return { status: 'failed', reason: 'timeout' };
    }
    return { status: 'failed', reason };
  }
}

module.exports = { emitLiveAlert };
