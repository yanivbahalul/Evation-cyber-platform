const path = require('path');
const fs = require('fs');

// Prefer `.env` next to this file, then merge admin panel secrets (monorepo local dev).
const dotenvQuiet = { quiet: true };
require('dotenv').config({ path: path.join(__dirname, '.env'), ...dotenvQuiet });
const adminEnvPath = path.join(__dirname, '../../apps/admin-panel/.env');
if (fs.existsSync(adminEnvPath) && !process.env.MALICIOUS_DB_URI) {
  require('dotenv').config({ path: adminEnvPath, ...dotenvQuiet });
}
const applyDevScript = path.join(__dirname, '../../apps/admin-panel/scripts/applyDevPublicHost.cjs');
if (fs.existsSync(applyDevScript)) {
  require(applyDevScript).applyDevPublicHost();
}

const express = require('express');
const http = require('http');
const { attackLog } = require('@evation/shared-utils');
const TRAP_TYPES = require('@evation/shared-constants');

const connectMaliciousDB = require('./config/maliciousDb');
const SocketService = require('./services/SocketService');
const { initLanEgressGeo } = require('./services/geoService');
const { router: internalRouter, processAttack } = require('./routes/internal');

const app = express();
app.use(express.json({ limit: '64kb' }));
app.set('trust proxy', true);

const server = http.createServer(app);

attackLog.info('TELEMETRY', 'server_starting', {});

const maliciousConn = connectMaliciousDB();
SocketService.init(server);

// Liveness probes — answer plainly so health checks (and a browser opened on
// the service port) never hit Express's raw "Cannot GET /" fallback.
app.get(['/', '/healthz'], (req, res) => {
  res.json({ service: 'telemetry', status: 'ok' });
});

app.use(internalRouter);

// Local smoke route: simulates a trap firing through the real write pipeline.
app.get('/test-trap', (req, res) => {
  processAttack({
    attackerIp: req.ip,
    trapType: TRAP_TYPES.DATA_BOMB,
    payload: JSON.stringify({ source: 'test-trap' }),
    wasted_time_ms: 1500,
    bytes_sent: 0,
    fingerprint: req.attackerFingerprint || {},
    timestamp: Date.now(),
  }).catch((err) => {
    attackLog.error('TELEMETRY', 'test_trap_failed', { error: err?.message || String(err) });
  });
  setTimeout(() => res.send('Trap finished. Check the logs and the socket alert.'), 1500);
});

// Unmatched routes return structured JSON instead of Express's raw "Cannot GET".
app.use((req, res) => {
  res.status(404).json({ success: false, error: 'not_found' });
});

app.use((err, req, res, next) => {
  attackLog.error('TELEMETRY', 'unhandled_express_error', {
    path: req?.originalUrl || req?.path,
    error: err?.message || String(err),
  });
  if (res.headersSent) return next(err);
  res.status(500).json({ success: false, error: 'internal_error' });
});

const PORT = process.env.PORT ? Number(process.env.PORT) : 3002;

async function startServer() {
  try {
    await initLanEgressGeo();
  } catch (err) {
    attackLog.warn('TELEMETRY', 'lan_egress_geo_init_failed', { error: err?.message || String(err) });
  }

  try {
    await maliciousConn.asPromise();
    attackLog.info('TELEMETRY', 'malicious_database_ready', {});
  } catch (err) {
    attackLog.error('TELEMETRY', 'malicious_database_connection_failed', { error: err?.message || String(err) });
    process.exit(1);
  }

  server.listen(PORT, '0.0.0.0', () => {
    attackLog.info('TELEMETRY', 'server_listening', { url: `http://0.0.0.0:${PORT}` });
  });

  const shutdown = (signal) => {
    attackLog.info('TELEMETRY', 'shutdown_started', { signal });
    server.close(() => {
      maliciousConn.close().finally(() => process.exit(0));
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

startServer().catch((err) => {
  attackLog.error('TELEMETRY', 'server_start_failed', { error: err?.message || String(err) });
  process.exit(1);
});
