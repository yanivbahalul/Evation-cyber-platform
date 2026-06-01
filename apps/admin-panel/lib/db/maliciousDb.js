const { createMaliciousConnection } = require('@evation/db-schemas');
const { startupLog } = require('@evation/shared-utils');

// Phase 1: logical air-gapping — isolated Malicious DB pipe (not the safezone connection).
// globalThis keeps one mongoose connection across Next.js server bundles / hot reload.
const GLOBAL_CONN_KEY = '__evation_malicious_mongoose__';
const GLOBAL_DISABLED_KEY = '__evation_malicious_disabled__';

const MALICIOUS_CONN_OPTIONS = {
    serverSelectionTimeoutMS: 8000,
    connectTimeoutMS: 8000,
    maxPoolSize: 10,
};

function attachPhase1Listeners(conn) {
    if (conn.__evationPhase1Listeners) return;
    conn.__evationPhase1Listeners = true;

    conn.on('error', (err) => {
        console.error('[EVATION] telemetry DB error:', err);
    });

    if (!startupLog.isVerbose()) return;

    conn.on('connected', () => {
        console.log('[EVATION] telemetry DB connected');
    });

    conn.on('disconnected', () => {
        console.warn('[EVATION] telemetry DB disconnected');
    });
}

const connectMaliciousDB = () => {
    if (globalThis[GLOBAL_CONN_KEY]) return globalThis[GLOBAL_CONN_KEY];
    if (globalThis[GLOBAL_DISABLED_KEY]) return null;

    const URI = process.env.MALICIOUS_DB_URI;
    if (!URI) {
        globalThis[GLOBAL_DISABLED_KEY] = true;
        throw new Error('Missing MALICIOUS_DB_URI env var for telemetry DB');
    }

    const conn = createMaliciousConnection(URI, MALICIOUS_CONN_OPTIONS);
    attachPhase1Listeners(conn);

    const schemas = require('@evation/db-schemas');
    if (!conn.models.AdminUser) {
        conn.model('AdminUser', schemas.AdminUserSchema);
    }

    globalThis[GLOBAL_CONN_KEY] = conn;
    return conn;
};

module.exports = connectMaliciousDB;
