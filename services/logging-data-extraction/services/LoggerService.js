const winston = require('winston');
const connectMaliciousDB = require('../config/maliciousDb');

// Phase 2: Automated Logging
// Winston handles human-readable console/stderr output.
// Persistence of structured AttackEvent rows is done via Mongoose against
// the isolated Malicious DB connection, so the schema in models/AttackEvent.js
// is the single source of truth for the attack_events collection.
const LoggerService = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
    ),
    transports: [
        new winston.transports.Console()
    ]
});

/**
 * Calculate the time wasted by the attacker (delta in milliseconds).
 */
LoggerService.calculateWastedTime = (startTime) => {
    return Date.now() - startTime;
};

/**
 * Main logging entry point used by telemetryTracker (and by Bar's traps directly).
 *
 * Expects:
 *   {
 *     attackerIp:     string,
 *     trapType:       string,
 *     payload:        string,
 *     wasted_time_ms: number,   // already-calculated delta
 *     bytes_sent:     number
 *   }
 *
 * Either pass `wasted_time_ms` directly, or pass `startTime` and we'll compute it.
 */
LoggerService.logAttack = async (attackData) => {
    const {
        attackerIp,
        trapType,
        payload,
        startTime,
        bytes_sent = 0
    } = attackData;

    const wasted_time_ms = attackData.wasted_time_ms != null
        ? attackData.wasted_time_ms
        : (startTime ? LoggerService.calculateWastedTime(startTime) : 0);

    // Console-side structured log
    LoggerService.info(`Attack Detected: ${trapType}`, {
        attackerIp, trapType, payload, wasted_time_ms, bytes_sent
    });

    // Persist into the isolated Malicious DB through Mongoose (Option B).
    try {
        const conn = connectMaliciousDB();
        const AttackEvent = conn.model('AttackEvent');
        await AttackEvent.create({
            attackerIp,
            trapType,
            payload,
            wasted_time_ms,
            bytes_sent
        });
    } catch (err) {
        console.error('❌ [LoggerService] Failed to persist AttackEvent:', err.message);
    }
};

module.exports = LoggerService;
