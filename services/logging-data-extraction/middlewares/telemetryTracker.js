// middlewares/telemetryTracker.js
const LoggerService = require('../services/LoggerService');
const SocketService = require('../services/SocketService');
const { upsertFromAttackSafe } = require('../services/AttackerProfileService');
const { getAttackerIp } = require('@evation/shared-utils');
const attackLog = require('../utils/attackLog');
const { resolveIpGeo } = require('../services/geoService');

const telemetryTracker = (trapType) => {
    return (req, res, next) => {
        const startTime = Date.now();

        res.on('finish', async () => {
            const wasted_time_ms = Date.now() - startTime;

            const attackerIp = getAttackerIp(req);
            const geo = await resolveIpGeo(attackerIp);
            const payload = req.body
                ? JSON.stringify(req.body)
                : req.query ? JSON.stringify(req.query) : 'N/A';

            const bytes_sent = res.locals.bytes_sent || 0;

            const attackData = {
                attackerIp,
                trapType,
                payload,
                wasted_time_ms,
                bytes_sent,
                city: geo.city,
                lat: geo.lat ?? 0,
                lng: geo.lng ?? 0,
                traceId: req.traceId,
                method: req.method,
                path: req.originalUrl || req.path,
                userAgent: req.headers['user-agent'],
                referer: req.headers['referer'] || req.headers['referrer'],
                fingerprint: req.attackerFingerprint || {},
                secondaryTraps: req.threatInfo?.secondary || [],
            };

            attackLog.info('TELEMETRY', 'trap_request_completed', {
                trap: trapType,
                trap_label: attackLog.trapLabel(trapType),
                ip: attackerIp,
                trace_id: req.traceId,
                wasted_ms: wasted_time_ms,
                bytes: bytes_sent,
                status: res.statusCode,
                log_flooding: !!req.isLogFlooding,
            });

            if (!req.isLogFlooding) {
                SocketService.emitLiveAlert(attackData);
                LoggerService.logAttack(attackData).catch((err) => {
                    attackLog.error('TELEMETRY', 'attack_log_pipeline_failed', { trap: trapType, error: err?.message || err });
                });
                await upsertFromAttackSafe(attackData);
            }
        });

        next();
    };
};

module.exports = telemetryTracker;
