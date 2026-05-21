/**
 * gatekeeper.js
 * Domain: Traffic Routing & Middleware Pipeline [cite: 3, 10]
 */
const detectionService = require('../services/detectionService');
const attackLog = require('../utils/attackLog');

module.exports = (req, res, next) => {
    const startTime = Date.now();
    const clientIP = req.ip;
    const userAgent = req.headers['user-agent'] || '';

    if (detectionService.isBlacklisted(clientIP)) {
        attackLog.warn('GATEWAY', 'request_blocked_blacklisted_ip', { ip: clientIP, ...attackLog.requestFields(req) });
        return res.status(403).send('Forbidden: IP Blacklisted');
    }

    const payload = {
        ...req.body,
        ...req.query,
        path: req.path,
        originalUrl: req.originalUrl,
    };
    const types = detectionService.isAuthFormPath(req.path)
        ? detectionService.getThreatTypesFromCredentials(req.body, userAgent)
        : detectionService.getThreatTypes(payload, userAgent);

    if (types.length) {
        const [primary, ...secondary] = types;
        attackLog.info('GATEWAY', 'threat_detected_routing_to_trap', {
            trap: primary,
            trap_label: attackLog.trapLabel(primary),
            secondary_traps: secondary.length ? secondary.join(',') : undefined,
            ip: clientIP,
            ...attackLog.requestFields(req),
        });
        req.threatInfo = { type: primary, secondary, originIP: clientIP };
        return next();
    }

    const duration = Date.now() - startTime;
    if (duration > 50) {
        attackLog.warn('GATEWAY', 'gatekeeper_slow', { duration_ms: duration, ...attackLog.requestFields(req) });
    }

    next();
};
