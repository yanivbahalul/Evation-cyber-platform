const path = require('path');
const fs = require('fs');

// Prefer `.env` next to this file, then merge admin panel secrets (monorepo local dev).
require('dotenv').config({ path: path.join(__dirname, '.env') });
const adminEnvPath = path.join(__dirname, '../../apps/adminpannel/.env.local');
if (fs.existsSync(adminEnvPath)) {
  require('dotenv').config({ path: adminEnvPath });
}

const express = require('express');
const app = express();

// Trust proxy headers set by Nginx (like X-Forwarded-For or X-Real-IP)
app.set('trust proxy', true);

const http = require('http').createServer(app);
const useragent = require('express-useragent');

console.log("Starting Max's Standalone Test Server...");

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

const TRAP_TYPES = require('./constants/trapTypes');

// A test trap route
app.get('/test-trap', telemetryTracker(TRAP_TYPES.DATA_BOMB), (req, res) => {
    // Simulate wasting the attacker's time
    setTimeout(() => {
        res.send("Trap Finished. Look at the logs and the socket alert!");
    }, 1500); 
});

const PORT = process.env.PORT ? Number(process.env.PORT) : 3002;

// Start listening
http.listen(PORT, () => {
    console.log(`✅ Test Server is live on http://localhost:${PORT}`);
    console.log('👉 DB connection: check the console line above for success.');
    console.log(`👉 Full pipeline test: hit http://localhost:${PORT}/test-trap`);
    console.log('👉 End-to-end smoke test: in another terminal run `npm run mock-attack`');
});
