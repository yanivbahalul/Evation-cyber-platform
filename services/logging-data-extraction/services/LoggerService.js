const winston = require('winston');
const connectMaliciousDB = require('../config/maliciousDb');
const attackLog = require('../utils/attackLog');
const { buildAttackEvent } = require('../utils/buildAttackEvent');

const LoggerService = winston.createLogger({
    level: 'info',
    transports: [],
});

LoggerService.calculateWastedTime = (startTime) => Date.now() - startTime;

LoggerService.logAttack = async (attackData) => {
    const {
        attackerIp,
        trapType,
        startTime,
        bytes_sent = 0
    } = attackData;

    const wasted_time_ms = attackData.wasted_time_ms != null
        ? attackData.wasted_time_ms
        : (startTime ? LoggerService.calculateWastedTime(startTime) : 0);

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
};

module.exports = LoggerService;
