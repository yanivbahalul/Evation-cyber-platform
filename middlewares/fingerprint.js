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
        console.warn("⚠️ [Phase 3] useragent object missing. Ensure app.use(useragent.express()) is set up.");
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

    console.log(`[Phase 3] Fingerprint: OS=${os}, Platform=${platform}, Browser=${browser} ${version}, Bot=${!!isBot}, Risk=${riskScore}`);

    next();
};

module.exports = fingerprintMiddleware;
