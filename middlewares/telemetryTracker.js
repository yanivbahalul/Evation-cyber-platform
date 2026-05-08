// middlewares/telemetryTracker.js
const LoggerService = require('../services/LoggerService');
const SocketService = require('../services/SocketService');
const getAttackerIp = require('../utils/getAttackerIp');
const geoip = require('geoip-lite');
const connectMaliciousDB = require('../config/maliciousDb');

// Wraps a Decoy Controller route. Captures wasted time, persists the
// AttackEvent through LoggerService, broadcasts a live alert, and upserts
// the AttackerProfile in the isolated Malicious DB.
const telemetryTracker = (trapType) => {
    return (req, res, next) => {
        const startTime = Date.now();

        res.on('finish', async () => {
            const wasted_time_ms = Date.now() - startTime;

            const attackerIp = getAttackerIp(req);
            const payload = req.body
                ? JSON.stringify(req.body)
                : req.query ? JSON.stringify(req.query) : 'N/A';

            // Bar's Decoy Controller can stamp this on res.locals from a stream's
            // `bytesWritten` so the data-bomb's bandwidth metric is accurate.
            const bytes_sent = res.locals.bytes_sent || 0;

            const attackData = {
                attackerIp,
                trapType,
                payload,
                wasted_time_ms,
                bytes_sent,
                fingerprint: req.attackerFingerprint || {}
            };

            if (!req.isLogFlooding) {
                // 1. Persist + console log via LoggerService (Mongoose write to attack_events).
                await LoggerService.logAttack(attackData);

                // 2. Sub-second WebSocket alert to Yaniv's Blue Team dashboard.
                SocketService.emitLiveAlert(attackData);
            }

            // 3. Upsert the AttackerProfile in the isolated Malicious DB.
            try {
                const maliciousConn = connectMaliciousDB();
                if (maliciousConn && maliciousConn.models.AttackerProfile) {
                    const AttackerProfile = maliciousConn.model('AttackerProfile');
                    const geo = geoip.lookup(attackerIp);

                    // riskScore accumulates: every event adds +1, plus the fingerprint
                    // bonus (e.g. +50 for confirmed bot UA). A persistent attacker therefore
                    // ramps up over time instead of being pinned at the last single-event value.
                    const riskDelta = 1 + (attackData.fingerprint.riskScore || 0);

                    await AttackerProfile.findOneAndUpdate(
                        { ip: attackerIp },
                        {
                            $setOnInsert: { ip: attackerIp, firstSeen: Date.now() },
                            $set: {
                                lastSeen: Date.now(),
                                city: geo ? geo.city : 'Unknown',
                                lat: geo && geo.ll ? geo.ll[0] : null,
                                lng: geo && geo.ll ? geo.ll[1] : null,
                                os: attackData.fingerprint.os,
                                platform: attackData.fingerprint.platform,
                                browser: attackData.fingerprint.browserVersion || attackData.fingerprint.browser,
                                deviceType: attackData.fingerprint.deviceType,
                                isBot: !!attackData.fingerprint.isBot
                            },
                            $inc: { riskScore: riskDelta }
                        },
                        { upsert: true, returnDocument: 'after' }
                    );
                }
            } catch (err) {
                console.error('❌ [Telemetry] Error saving AttackerProfile:', err.message);
            }
        });

        next();
    };
};

module.exports = telemetryTracker;
