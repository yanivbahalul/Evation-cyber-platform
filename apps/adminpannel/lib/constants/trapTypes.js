// Aligned with services/logging-data-extraction/constants/trapTypes.js (gateway writes these values)
const TRAP_TYPES = {
    DATA_BOMB: 'DATA_BOMB',
    SQLI: 'SQLI',
    BRUTE_FORCE: 'BRUTE_FORCE',
    XSS: 'XSS',
    HONEY_TOKEN: 'HONEY_TOKEN',
    RECON: 'RECON',
    PATH_TRAVERSAL: 'PATH_TRAVERSAL',
    SSRF: 'SSRF',
    SCANNER: 'SCANNER',
};

module.exports = TRAP_TYPES;
