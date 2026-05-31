'use strict';

const attackLog = require('./attackLog');
const getAttackerIp = require('./getAttackerIp');

// Express middleware that derives an attacker fingerprint from the User-Agent.
// Requires `app.use(useragent.express())` to have run first.
module.exports = function fingerprint(req, res, next) {
  if (!req.useragent) {
    attackLog.warn('GATEWAY', 'fingerprint_skipped_no_useragent');
    return next();
  }

  const ua = String(req.headers?.['user-agent'] || '');
  let { os, platform, browser, version, isMobile, isBot } = req.useragent;

  // iOS User-Agents contain "like Mac OS X"; trust explicit iPhone/iPad/iPod signals.
  if (/\b(iPhone|iPad|iPod)\b/i.test(ua)) {
    os = 'iOS';
    platform = 'iOS';
    isMobile = true;
  }

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
    riskScore,
  };

  if (req.threatInfo || req.path?.includes('/internal/') || req.path?.includes('trap')) {
    attackLog.info('GATEWAY', 'attacker_fingerprint', {
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
