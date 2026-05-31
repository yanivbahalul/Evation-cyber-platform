'use strict';

const express = require('express');
const { attackLog } = require('@evation/shared-utils');

const SocketService = require('../services/SocketService');
const AttackEventService = require('../services/AttackEventService');
const honeyTokenService = require('../services/honeyTokenService');
const {
  upsertFromAttackSafe,
  recordScreenResolution,
  getBannedIps,
} = require('../services/AttackerProfileService');
const { resolveIpGeo, applyGeoToPayload } = require('../services/geoService');

const router = express.Router();

function requireToken(req, res, next) {
  const expected = process.env.ADMIN_SOCKET_TOKEN;
  if (!expected) {
    return res.status(503).json({ success: false, error: 'ADMIN_SOCKET_TOKEN not configured' });
  }
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (token !== expected) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }
  next();
}

function hasResolvedGeo(body) {
  const city = body?.city;
  return Boolean(city && city !== 'Unknown' && city !== '—');
}

/** Full geo lookup before broadcast so live alerts and profiles stay in sync. */
async function enrichGeo(body) {
  const raw = body || {};
  if (hasResolvedGeo(raw)) {
    return {
      ...raw,
      lat: raw.lat ?? 0,
      lng: raw.lng ?? 0,
    };
  }

  const ip = raw.attackerIp;
  if (!ip) return raw;

  const geo = await resolveIpGeo(ip);
  return applyGeoToPayload(raw, geo);
}

/**
 * Single write path for a trap event: broadcast to the dashboard, persist the
 * AttackEvent, and upsert the AttackerProfile. The telemetry service owns every
 * malicious-DB write.
 */
async function processAttack(rawBody) {
  const body = await enrichGeo(rawBody || {});

  SocketService.emitLiveAlert(body);

  AttackEventService.recordEvent(body).catch((err) => {
    attackLog.error('ATTACK', 'event_record_failed', {
      trap: body?.trapType,
      ip: body?.attackerIp,
      error: err.message,
    });
  });

  void upsertFromAttackSafe(body);

  return body;
}

// Gateway → telemetry: persist event + upsert profile + broadcast liveAlert.
async function handleAttack(req, res) {
  attackLog.info('TELEMETRY', 'attack_received_from_gateway', {
    trap: req.body?.trapType,
    ip: req.body?.attackerIp,
    trace_id: req.body?.traceId,
  });
  await processAttack(req.body || {});
  return res.json({ success: true });
}

router.post('/internal/attack', requireToken, handleAttack);
// Backward-compatible alias for any in-flight gateway build.
router.post('/internal/live-alert', requireToken, handleAttack);

// Honey-token persistence (telemetry owns the HoneyToken collection).
router.post('/internal/honey-token', requireToken, async (req, res) => {
  try {
    const { fakeUsername, fakePassword } = req.body || {};
    if (!fakeUsername || !fakePassword) {
      return res.status(400).json({ success: false, error: 'missing_fields' });
    }
    const result = await honeyTokenService.create({ fakeUsername, fakePassword });
    return res.json({ success: true, ...result });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/internal/honey-token/check', requireToken, async (req, res) => {
  try {
    const result = await honeyTokenService.check(req.query?.value);
    return res.json({ success: true, ...result });
  } catch (err) {
    return res.status(500).json({ success: false, hit: false, error: err.message });
  }
});

router.post('/internal/honey-token/usage', requireToken, async (req, res) => {
  try {
    const { value, attackerIp, networkContext } = req.body || {};
    await honeyTokenService.recordUsage(value, { attackerIp, networkContext });
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Gateway ban enforcement reads the banned-IP set from here (no direct DB access).
router.get('/internal/banned-ips', requireToken, async (req, res) => {
  try {
    const ips = await getBannedIps();
    return res.json({ success: true, ips });
  } catch (err) {
    return res.status(500).json({ success: false, ips: [], error: err.message });
  }
});

// Client-side screen-resolution beacon (only updates existing attacker profiles).
router.post('/internal/screen-resolution', requireToken, async (req, res) => {
  try {
    const { attackerIp, screenResolution } = req.body || {};
    if (attackerIp && screenResolution) {
      await recordScreenResolution(attackerIp, screenResolution);
    }
    return res.json({ success: true });
  } catch {
    return res.json({ success: true });
  }
});

module.exports = { router, processAttack };
