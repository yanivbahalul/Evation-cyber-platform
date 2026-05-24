const path = require('path');
const fs = require('fs');

// Prefer `.env` next to this file, then merge admin panel secrets (monorepo local dev).
const dotenvQuiet = { quiet: true };
require('dotenv').config({ path: path.join(__dirname, '.env'), ...dotenvQuiet });
const adminEnvPath = path.join(__dirname, '../../apps/admin-panel/.env.local');
if (fs.existsSync(adminEnvPath) && !process.env.MALICIOUS_DB_URI) {
  require('dotenv').config({ path: adminEnvPath, ...dotenvQuiet });
}
require('../../apps/admin-panel/scripts/applyDevPublicHost.cjs').applyDevPublicHost();

const express = require('express');
const app = express();
app.use(express.json({ limit: '64kb' }));

// Trust proxy headers set by Nginx (like X-Forwarded-For or X-Real-IP)
app.set('trust proxy', true);

const http = require('http').createServer(app);
const useragent = require('express-useragent');

const attackLog = require('./utils/attackLog');
attackLog.info('TELEMETRY', 'server_starting', {});

// 1. Test your Isolated Database
const connectMaliciousDB = require('./config/maliciousDb');
const maliciousConn = connectMaliciousDB();

// 2. Test your Fingerprint Middleware
app.use(useragent.express());
const fingerprintMiddleware = require('./middlewares/fingerprint');
app.use(fingerprintMiddleware);

// 3. Test your Real-Time Sockets using your dedicated module
const SocketService = require('./services/SocketService');
SocketService.init(http); // Inject the HTTP server

// === NEW FEATURE: Log Flooding Limiter ===
const logLimiter = require('./middlewares/logLimiter');
app.use(logLimiter);

// 4. Test the Telemetry Tracker (Wasted Time + Live Alerts)
const telemetryTracker = require('./middlewares/telemetryTracker');

const TRAP_TYPES = require('@evation/shared-constants');

const { upsertFromAttackSafe } = require('./services/AttackerProfileService');
const { resolveIpGeo, initLanEgressGeo } = require('./services/geoService');

async function enrichLiveAlertBody(body) {
    const ip = body?.attackerIp;
    const hasCity = body?.city && body.city !== 'Unknown';
    const geo = !hasCity && ip ? await resolveIpGeo(ip) : null;
    return {
        ...body,
        city: hasCity ? body.city : (geo?.city ?? body?.city ?? 'Unknown'),
        lat: body?.lat || geo?.lat || 0,
        lng: body?.lng || geo?.lng || 0,
    };
}

// Gateway (decoy) → telemetry: upsert profile + broadcast liveAlert (AttackEvent already saved in gateway)
app.post('/internal/live-alert', async (req, res) => {
    attackLog.info('TELEMETRY', 'live_alert_received_from_gateway', {
        trap: req.body?.trapType,
        ip: req.body?.attackerIp,
        trace_id: req.body?.traceId,
    });
    const expected = process.env.ADMIN_SOCKET_TOKEN;
    if (!expected) {
        return res.status(503).json({ success: false, error: 'ADMIN_SOCKET_TOKEN not configured' });
    }
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    if (token !== expected) {
        return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const body = await enrichLiveAlertBody(req.body || {});
    await upsertFromAttackSafe(body);
    SocketService.emitLiveAlert(body);
    return res.json({ success: true });
});

// A test trap route
app.get('/test-trap', telemetryTracker(TRAP_TYPES.DATA_BOMB), (req, res) => {
    // Simulate wasting the attacker's time
    setTimeout(() => {
        res.send("Trap Finished. Look at the logs and the socket alert!");
    }, 1500); 
});

const PORT = process.env.PORT ? Number(process.env.PORT) : 3002;

initLanEgressGeo()
    .catch(() => {})
    .finally(() => {
        http.listen(PORT, () => {
            attackLog.info('TELEMETRY', 'server_listening', {
                url: `http://localhost:${PORT}`,
                test_trap: `${PORT}/test-trap`,
            });
        });
    });
