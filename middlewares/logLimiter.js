// middlewares/logLimiter.js
// Solves Phase 2 Potential Problem: "Log Flooding"

// We use an incredibly fast native JavaScript Map to track hits in memory.
// This prevents attackers from DDOSing our MongoDB cluster with heavy logging queries.
const floodTracker = new Map();

const getAttackerIp = require('../utils/getAttackerIp');

const logLimiter = (req, res, next) => {
    // Rely on your newly upgraded getAttackerIp logic from Sagiv
    const ip = getAttackerIp(req);
    const now = Date.now();
    
    if (!floodTracker.has(ip)) {
        floodTracker.set(ip, []);
    }
    
    const timestamps = floodTracker.get(ip);
    
    // Clean up memory: Keep only requests from the last 5 seconds (5000ms)
    const recentHits = timestamps.filter(time => now - time < 5000);
    recentHits.push(now);
    floodTracker.set(ip, recentHits);
    
    // Threshold: If an attacker triggers more than 30 traps in 5 seconds, they are log-flooding.
    if (recentHits.length > 30) {
        console.warn(`🛑 [Log Limiter] Attack flood detected from ${ip}. Silencing DB logs.`);
        req.isLogFlooding = true; // Flags it so TelemetryService knows to ignore it
        
        // At this point we could also trigger an IP Ban (Yaniv's dashboard feature)
    }

    next();
};

module.exports = logLimiter;
