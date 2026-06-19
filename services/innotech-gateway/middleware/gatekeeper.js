// Ban check + regex threat detection. Sets req.threatInfo for decoyReroute.
const detectionService = require('../services/detectionService');
const TRAP_TYPES = require('@evation/shared-constants');
const { getAttackerIp, attackLog } = require('@evation/shared-utils');
const httpTrickle = require('../traps/httpTrickle');

module.exports = (req, res, next) => {
    const startTime = Date.now();
    const clientIP = getAttackerIp(req);
    const userAgent = req.headers['user-agent'] || '';

    if (detectionService.isBlacklisted(clientIP)) {
        // Confirmed attacker — slow-trickle 1 byte / 10s instead of an honest
        // 403 (per Requirements §HTTP Trait). The attacker stays "connected"
        // instead of learning we've flagged them.
        attackLog.warn('GATEWAY', 'confirmed_attacker_trickled', {
            ip: clientIP,
            ...attackLog.requestFields(req),
        });
        try {
            const { report } = require('../controllers/decoyController');
            return httpTrickle.stream(req, res, { report });
        } catch (err) {
            return res.status(403).send('Forbidden: IP Blacklisted');
        }
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
        const honeyActive = req.threatInfo?.type === TRAP_TYPES.HONEY_TOKEN;
        const trap = honeyActive ? TRAP_TYPES.HONEY_TOKEN : primary;
        const secondaryTraps = honeyActive ? [...secondary, primary] : secondary;
        attackLog.info('GATEWAY', 'threat_detected_routing_to_trap', {
            trap,
            trap_label: attackLog.trapLabel(trap),
            secondary_traps: secondaryTraps.length ? secondaryTraps.join(',') : undefined,
            ip: clientIP,
            ...attackLog.requestFields(req),
        });
        req.threatInfo = honeyActive
            ? { type: TRAP_TYPES.HONEY_TOKEN, secondary: secondaryTraps, originIP: clientIP }
            : { type: primary, secondary, originIP: clientIP };
        return next();
    }

    const duration = Date.now() - startTime;
    if (duration > 50) {
        attackLog.warn('GATEWAY', 'gatekeeper_slow', { duration_ms: duration, ...attackLog.requestFields(req) });
    }

    next();
};
