'use strict';

const connectMaliciousDB = require('../config/maliciousDb');
const { attackLog } = require('@evation/shared-utils');
const { buildAttackEvent } = require('../utils/buildAttackEvent');

function calculateWastedTime(startTime) {
  return Date.now() - startTime;
}

/**
 * Persist a single trap event into the malicious DB. This is the only place
 * attack_events are written — both the gateway (via /internal/attack) and the
 * local /test-trap smoke route funnel through here.
 */
async function recordEvent(attackData) {
  const { attackerIp, trapType, startTime, bytes_sent = 0 } = attackData;

  const wasted_time_ms =
    attackData.wasted_time_ms != null
      ? attackData.wasted_time_ms
      : startTime
        ? calculateWastedTime(startTime)
        : 0;

  const docFields = buildAttackEvent({ ...attackData, wasted_time_ms, bytes_sent });

  try {
    const conn = connectMaliciousDB();
    const AttackEvent = conn.model('AttackEvent');
    const doc = await AttackEvent.create(docFields);

    attackLog.info('ATTACK', 'event_saved_to_malicious_db', {
      trap: trapType,
      trap_label: attackLog.trapLabel(trapType),
      ip: attackerIp,
      trace_id: docFields.traceId,
      event_id: doc.eventID,
      wasted_ms: wasted_time_ms,
      bytes: bytes_sent,
      payload: attackLog.truncate(docFields.payload, 80),
      collection: 'attack_events',
    });
    return doc;
  } catch (err) {
    attackLog.error('ATTACK', 'event_save_failed', {
      trap: trapType,
      ip: attackerIp,
      error: err.message,
    });
    throw err;
  }
}

module.exports = { recordEvent, calculateWastedTime };
