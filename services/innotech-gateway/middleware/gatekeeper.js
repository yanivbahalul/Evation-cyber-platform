/**
 * gatekeeper.js
 * Domain: Traffic Routing & Middleware Pipeline [cite: 3, 10]
 */
const detectionService = require('../services/detectionService');

module.exports = (req, res, next) => {
    const startTime = Date.now();
    const clientIP = req.ip;

    // 1. IP Reputation Check 
    if (detectionService.isBlacklisted(clientIP)) {
        return res.status(403).send('Forbidden: IP Blacklisted');
    }

    // 2. Deep Packet Inspection (DPI) [cite: 13]
    const payload = { ...req.body, ...req.query };
    const threat = detectionService.getThreatType(payload);

    if (threat) {
        // silentReroute Algorithm: Invisible handoff 
        console.log(`[GATEKEEPER] ${threat} detected. Rerouting...`);
        
        req.threatInfo = { type: threat, originIP: clientIP }; 
        req.url = '/decoy-portal'; 
        
        return next(); 
    }

    // Performance Audit: Ensure execution is < 50ms 
    const duration = Date.now() - startTime;
    if (duration > 50) console.warn(`Latency Warning: ${duration}ms`);

    next(); // Safe Zone [cite: 19]
};