/**
 * detectionService.js
 * Domain: Threat Intelligence & Logic [cite: 3]
 */

// In-memory blacklist for O(1) lookups 
const bannedIPs = new Set(['1.2.3.4', '5.6.7.8']); 

// Audited Regex patterns to prevent ReDoS [cite: 14]
const patterns = {
    SQLI: /(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|--|;)/i,
    XSS: /(<script|javascript:|onerror=|alert\(|onload=)/i
};

/**
 * checkIP: Validates if an IP is in the reputation blacklist 
 */
exports.isBlacklisted = (ip) => bannedIPs.has(ip);

/**
 * analyzePayload: Scans data for specific threat signatures [cite: 13]
 * @returns {string|null} The type of threat detected (SQLI/XSS) or null
 */
exports.getThreatType = (data) => {
    const content = Object.values(data).join(' ');
    
    if (patterns.SQLI.test(content)) return 'SQLI';
    if (patterns.XSS.test(content)) return 'XSS';
    
    return null;
};