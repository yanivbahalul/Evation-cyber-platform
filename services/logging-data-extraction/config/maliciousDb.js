const { createMaliciousConnection } = require('@evation/db-schemas');
const { attackLog } = require('@evation/shared-utils');

let maliciousConn = null;
let maliciousConnDisabled = false;

const connectMaliciousDB = () => {
    if (maliciousConn) return maliciousConn;
    if (maliciousConnDisabled) return null;

    const URI = process.env.MALICIOUS_DB_URI;
    if (!URI) {
        maliciousConnDisabled = true;
        throw new Error('Missing MALICIOUS_DB_URI env var for malicious telemetry DB');
    }

    maliciousConn = createMaliciousConnection(URI);

    maliciousConn.on('connected', () => {
        attackLog.info('TELEMETRY', 'malicious_database_connected', {
            database: maliciousConn.name || 'telemetry',
        });
    });

    maliciousConn.on('error', (err) => {
        attackLog.error('TELEMETRY', 'malicious_database_error', { error: err.message });
    });

    return maliciousConn;
};

module.exports = connectMaliciousDB;
