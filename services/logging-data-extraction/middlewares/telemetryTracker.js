// middlewares/telemetryTracker.js
const LoggerService = require('../services/LoggerService');
const SocketService = require('../services/SocketService');
const { upsertFromAttackSafe } = require('../services/AttackerProfileService');
const { getAttackerIp } = require('@evation/shared-utils');
const attackLog = require('../utils/attackLog');
const { resolveIpGeo, resolveIpGeoFast } = require('../services/geoService');

function safeStringify(value) {
    try {
        return JSON.stringify(value);
    } catch {
        return 'N/A';
    }
}

const telemetryTracker = (trapType) => {
    return (req, res, next) => {
        const startTime = Date.now();

        res.on('finish', () => {
            void (async () => {
                try {
                    const wasted_time_ms = Date.now() - startTime;
                    const attackerIp = getAttackerIp(req);
                    const bytes_sent = res.locals.bytes_sent || 0;

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

                    if (req.isLogFlooding) return;

                    const geo = resolveIpGeoFast(attackerIp);
                    const payload = req.body
                        ? safeStringify(req.body)
                        : req.query ? safeStringify(req.query) : 'N/A';

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

                    SocketService.emitLiveAlert(attackData);
                    LoggerService.logAttack(attackData).catch((err) => {
                        attackLog.error('TELEMETRY', 'attack_log_pipeline_failed', { trap: trapType, error: err?.message || err });
                    });
                    void upsertFromAttackSafe(attackData);
                    void resolveIpGeo(attackerIp)
                        .then((fullGeo) => {
                            if (!fullGeo?.city || fullGeo.city === 'Unknown' || fullGeo.city === geo.city) return;
                            return upsertFromAttackSafe({
                                ...attackData,
                                city: fullGeo.city,
                                lat: fullGeo.lat ?? 0,
                                lng: fullGeo.lng ?? 0,
                            });
                        })
                        .catch(() => {});
                } catch (err) {
                    attackLog.error('TELEMETRY', 'finish_handler_failed', {
                        trap: trapType,
                        error: err?.message || String(err),
                    });
                }
            })();
        });

        next();
    };
};

module.exports = telemetryTracker;
