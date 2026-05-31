'use strict';

const { attackLog } = require('@evation/shared-utils');

const TIMEOUT_MS = 5000;

function telemetryBase() {
  // TELEMETRY_URL = internal service URL (e.g. http://telemetry:3002 in Docker).
  // Do NOT fall back to NEXT_PUBLIC_TELEMETRY_SOCKET_URL — that is the browser
  // Socket.IO entrypoint via nginx (:3000/socket.io/), not /internal/* APIs.
  const base = process.env.TELEMETRY_URL || 'http://localhost:3002';
  return String(base).replace(/\/$/, '');
}

function authToken() {
  return process.env.ADMIN_SOCKET_TOKEN || '';
}

async function telemetryFetch(pathname, { method = 'POST', body, query } = {}) {
  const token = authToken();
  if (!token) {
    const err = new Error('no_token');
    err.code = 'NO_TOKEN';
    throw err;
  }

  let url = `${telemetryBase()}${pathname}`;
  if (query) {
    const qs = new URLSearchParams(query).toString();
    if (qs) url += `?${qs}`;
  }

  const res = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: body != null ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    const err = new Error(`telemetry HTTP ${res.status}: ${text.slice(0, 200)}`);
    err.status = res.status;
    throw err;
  }
  return res;
}

/**
 * Report a fired trap to the telemetry service. The single POST persists the
 * AttackEvent, upserts the AttackerProfile, and broadcasts the live alert.
 */
async function reportAttack(eventData) {
  try {
    await telemetryFetch('/internal/attack', { body: { ...eventData, timestamp: Date.now() } });
    attackLog.info('TRAP', 'attack_reported_to_telemetry', {
      trap: eventData.trapType,
      trap_label: attackLog.trapLabel(eventData.trapType),
      ip: eventData.attackerIp,
      trace_id: eventData.traceId,
    });
    return { status: 'sent' };
  } catch (err) {
    if (err.code === 'NO_TOKEN') {
      attackLog.warn('TRAP', 'attack_report_skipped_no_token', { trap: eventData.trapType });
      return { status: 'skipped', reason: 'no_token' };
    }
    attackLog.error('TRAP', 'attack_report_failed', {
      trap: eventData.trapType,
      ip: eventData.attackerIp,
      error: err.message,
    });
    return { status: 'failed', reason: err.message };
  }
}

/** Persist a freshly issued honey-token credential. */
async function generateHoneyToken({ fakeUsername, fakePassword }) {
  try {
    const res = await telemetryFetch('/internal/honey-token', { body: { fakeUsername, fakePassword } });
    return await res.json();
  } catch (err) {
    attackLog.warn('TRAP', 'honey_token_persist_failed', { error: err.message });
    return null;
  }
}

/** Check whether a presented value matches an issued honey-token. Fails closed (false) on error. */
async function checkHoneyToken(value) {
  try {
    const res = await telemetryFetch('/internal/honey-token/check', { method: 'GET', query: { value } });
    const data = await res.json();
    return { hit: !!data.hit, fakeUsername: data.fakeUsername };
  } catch (err) {
    attackLog.warn('TRAP', 'honey_token_check_failed', { error: err.message });
    return { hit: false };
  }
}

/** Record usage of an issued honey-token. */
async function recordHoneyUsage(value, ctx = {}) {
  try {
    await telemetryFetch('/internal/honey-token/usage', {
      body: { value, attackerIp: ctx.attackerIp, networkContext: ctx.networkContext },
    });
  } catch (err) {
    attackLog.warn('TRAP', 'honey_token_usage_failed', { error: err.message });
  }
}

/** Fetch the current banned-IP set for gateway enforcement. */
async function fetchBannedIps() {
  const res = await telemetryFetch('/internal/banned-ips', { method: 'GET' });
  const data = await res.json();
  return Array.isArray(data.ips) ? data.ips : [];
}

/** Forward a client-side screen-resolution beacon. */
async function postScreenResolution(attackerIp, screenResolution) {
  try {
    await telemetryFetch('/internal/screen-resolution', { body: { attackerIp, screenResolution } });
  } catch {
    /* best-effort beacon */
  }
}

module.exports = {
  reportAttack,
  generateHoneyToken,
  checkHoneyToken,
  recordHoneyUsage,
  fetchBannedIps,
  postScreenResolution,
};
