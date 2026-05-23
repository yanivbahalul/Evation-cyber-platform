/**
 * detectionService.js
 * Domain: Threat Intelligence & Logic [cite: 3]
 */

const TRAP_TYPES = require('@evation/shared-constants');
const { isLegacySignInPath } = require('../config/deceptionPaths');

const bannedIPs = new Set(['1.2.3.4', '5.6.7.8']);

const patterns = {
    SQLI: /(?:\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|ALTER|CREATE|EXEC|EXECUTE)\b|(?:'|")\s*(?:OR|AND)\s+|(?:OR|AND)\s+['"]?\d+['"]?\s*=\s*['"]?\d+|--|#|\/\*|\*\/|;|\bSLEEP\s*\(|\bBENCHMARK\s*\(|\bWAITFOR\s+DELAY|\binformation_schema\b|\bCHAR\s*\(|\bCONCAT\s*\(|\b0x[0-9a-fA-F]{4,})/i,
    XSS: /(<script|javascript:|onerror=|alert\(|onload=)/i,
    DATA_BOMB: /(backup\.zip|\.zip\b|\/backup|download=|export=|dump=|full.?backup)/i,
    RECON: /(wp-admin|wp-login|\.env|phpmyadmin|admin\.php|\/\.git|actuator\/health|swagger|api\/v1\/users)/i,
    PATH_TRAVERSAL: /(\.\.\/|\.\.\\|%2e%2e|%2fetc%2f|\/etc\/passwd|file:\/\/)/i,
    SSRF: /(url\s*=\s*https?|169\.254\.|metadata\.google|\/latest\/meta-data|localhost:\d+|127\.0\.0\.1)/i,
    SCANNER_UA: /sqlmap|nikto|acunetix|nmap|masscan|zgrab|wpscan|dirbuster|gobuster|burp/i,
};

const PRIORITY = [
    TRAP_TYPES.SCANNER,
    TRAP_TYPES.SQLI,
    TRAP_TYPES.SSRF,
    TRAP_TYPES.PATH_TRAVERSAL,
    TRAP_TYPES.XSS,
    TRAP_TYPES.DATA_BOMB,
    TRAP_TYPES.RECON,
];

function uniqueOrdered(types) {
    const seen = new Set();
    const out = [];
    for (const t of PRIORITY) {
        if (types.includes(t) && !seen.has(t)) {
            seen.add(t);
            out.push(t);
        }
    }
    return out;
}

function matchContent(content, userAgent = '') {
    const types = [];
    const ua = String(userAgent || '');
    if (patterns.SCANNER_UA.test(ua)) types.push(TRAP_TYPES.SCANNER);
    if (patterns.SQLI.test(content)) types.push(TRAP_TYPES.SQLI);
    if (patterns.SSRF.test(content)) types.push(TRAP_TYPES.SSRF);
    if (patterns.PATH_TRAVERSAL.test(content)) types.push(TRAP_TYPES.PATH_TRAVERSAL);
    if (patterns.XSS.test(content)) types.push(TRAP_TYPES.XSS);
    if (patterns.DATA_BOMB.test(content)) types.push(TRAP_TYPES.DATA_BOMB);
    if (patterns.RECON.test(content)) types.push(TRAP_TYPES.RECON);
    return uniqueOrdered(types);
}

exports.isBlacklisted = (ip) => bannedIPs.has(ip);

exports.getThreatTypesFromCredentials = (body = {}, userAgent = '') => {
    const content = [body.username, body.password].filter(Boolean).join(' ');
    return matchContent(content, userAgent);
};

exports.getThreatTypes = (data = {}, userAgent = '') => {
    const content = Object.values(data).join(' ');
    return matchContent(content, userAgent);
};

/** @deprecated use getThreatTypes — first match only */
exports.getThreatTypeFromCredentials = (body = {}, userAgent = '') => {
    const types = exports.getThreatTypesFromCredentials(body, userAgent);
    return types[0] || null;
};

/** @deprecated use getThreatTypes — first match only */
exports.getThreatType = (data = {}, userAgent = '') => {
    const types = exports.getThreatTypes(data, userAgent);
    return types[0] || null;
};

exports.isAuthFormPath = (path = '') => {
    const p = String(path);
    return (
        p === '/login' ||
        p.endsWith('/login') ||
        p.includes('/login/verify-otp') ||
        p === '/register' ||
        p.endsWith('/register') ||
        p.includes('/register/verify-otp') ||
        isLegacySignInPath(p)
    );
};
