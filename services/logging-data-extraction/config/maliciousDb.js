const { createMaliciousConnection } = require('@evation/db-schemas');
const { attackLog, startupLog } = require('@evation/shared-utils');

const GLOBAL_CONN_KEY = '__evation_malicious_mongoose__';
const GLOBAL_DISABLED_KEY = '__evation_malicious_disabled__';

const MALICIOUS_CONN_OPTIONS = {
    serverSelectionTimeoutMS: 8000,
    connectTimeoutMS: 8000,
    maxPoolSize: 10,
};

function attachTelemetryListeners(conn) {
    if (conn.__evationTelemetryDbListeners) return;
    conn.__evationTelemetryDbListeners = true;

    conn.on('error', (err) => {
        attackLog.error('TELEMETRY', 'malicious_database_error', { error: err.message });
    });

    if (!startupLog.isVerbose()) return;

    conn.on('connected', () => {
        attackLog.info('TELEMETRY', 'malicious_database_connected', {
            database: conn.name || 'telemetry',
        });
    });

    conn.on('disconnected', () => {
        attackLog.warn('TELEMETRY', 'malicious_database_disconnected', {
            database: conn.name || 'telemetry',
        });
    });
}

const connectMaliciousDB = () => {
    if (globalThis[GLOBAL_CONN_KEY]) return globalThis[GLOBAL_CONN_KEY];
    if (globalThis[GLOBAL_DISABLED_KEY]) return null;

    const URI = process.env.MALICIOUS_DB_URI;
    if (!URI) {
        globalThis[GLOBAL_DISABLED_KEY] = true;
        throw new Error('Missing MALICIOUS_DB_URI env var for malicious telemetry DB');
    }

    const conn = createMaliciousConnection(URI, MALICIOUS_CONN_OPTIONS);
    attachTelemetryListeners(conn);
    globalThis[GLOBAL_CONN_KEY] = conn;
    return conn;
};

module.exports = connectMaliciousDB;
