'use strict';

const attackLog = require('./attackLog');

async function emitLiveAlert(trapData) {
  const base =
    process.env.TELEMETRY_URL ||
    process.env.NEXT_PUBLIC_TELEMETRY_SOCKET_URL ||
    'http://localhost:3002';
  const token = process.env.ADMIN_SOCKET_TOKEN;
  if (!token) {
    attackLog.warn('TRAP', 'live_alert_skipped_no_token', { trap: trapData?.trapType });
    return;
  }

  const url = `${String(base).replace(/\/$/, '')}/internal/live-alert`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(trapData),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`telemetry HTTP ${res.status}: ${body.slice(0, 200)}`);
  }
}

module.exports = { emitLiveAlert };
