'use strict';

const TRAP_TYPES = require('../../logging-data-extraction/constants/trapTypes');
const LoggerService = require('../../logging-data-extraction/services/LoggerService');
const { emitLiveAlert } = require('./telemetryLiveAlert');
const attackLog = require('./attackLog');

function getIP(req) {
  return (
    req.threatInfo?.originIP ||
    req.headers['x-forwarded-for']?.split(',')[0].trim() ||
    req.ip ||
    'unknown'
  );
}

function buildEventFields(req) {
  return {
    traceId: req.traceId,
    method: req.method,
    path: req.originalUrl || req.path,
    userAgent: req.headers['user-agent'],
    referer: req.headers['referer'] || req.headers['referrer'],
    fingerprint: req.attackerFingerprint || {},
    secondaryTraps: req.threatInfo?.secondary || [],
  };
}

async function reportHoneyTokenHit(req) {
  const eventData = {
    attackerIp: getIP(req),
    trapType: TRAP_TYPES.HONEY_TOKEN,
    payload: JSON.stringify({ action: 'token_used', path: req.originalUrl || req.path }),
    wasted_time_ms: 0,
    bytes_sent: 0,
    timestamp: Date.now(),
    ...buildEventFields(req),
  };

  try {
    await LoggerService.logAttack(eventData);
    attackLog.info('TRAP', 'honey_token_hit_saved', {
      ip: eventData.attackerIp,
      trace_id: req.traceId,
      path: attackLog.truncate(eventData.payload, 80),
    });
  } catch (err) {
    attackLog.error('TRAP', 'honey_token_hit_save_failed', { ip: eventData.attackerIp, error: err.message });
  }

  try {
    await emitLiveAlert(eventData);
    attackLog.info('TRAP', 'honey_token_hit_live_alert_sent', { ip: eventData.attackerIp });
  } catch (err) {
    attackLog.error('TRAP', 'honey_token_hit_live_alert_failed', { ip: eventData.attackerIp, error: err.message });
  }
}

module.exports = { reportHoneyTokenHit };
