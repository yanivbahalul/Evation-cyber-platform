// Phase 3.1 — Fingerprinting
//
// Extracts attacker metadata at request-time from raw HTTP headers:
//   - Operating System  (User-Agent → os)
//   - Platform          (User-Agent → platform, e.g. Linux/Windows/Android)
//   - Browser + version (User-Agent)
//   - Device type       (User-Agent → isMobile)
//   - isBot flag        (User-Agent)
//
// Prereq: app.use(useragent.express()) must run before this middleware.

const fingerprintMiddleware = (req, res, next) => {
    if (!req.useragent) {
        require('../utils/attackLog').warn('TELEMETRY', 'fingerprint_skipped_no_useragent');
        return next();
    }

    const { os, platform, browser, version, isMobile, isBot } = req.useragent;

    // Per-event base risk contribution (the running total lives on AttackerProfile via $inc).
    let riskScore = 0;
    if (isBot) riskScore += 50;

    req.attackerFingerprint = {
        os,
        platform,
        browser,
        version,
        browserVersion: `${browser} ${version}`,
        deviceType: isMobile ? 'Mobile' : 'Desktop',
        isBot: !!isBot,
        riskScore
    };

    if (req.threatInfo || req.path?.includes('/internal/') || req.path?.includes('trap')) {
        const { getAttackerIp } = require('@evation/shared-utils');
        require('../utils/attackLog').info('TELEMETRY', 'attacker_fingerprint', {
            ip: getAttackerIp(req),
            os,
            platform,
            browser: `${browser} ${version}`.trim(),
            bot: !!isBot,
            risk_score: riskScore,
            path: req.originalUrl || req.path,
        });
    }

    next();
};

module.exports = fingerprintMiddleware;
