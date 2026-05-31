const express = require('express');
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

const dotenvQuiet = { quiet: true };
require('dotenv').config(dotenvQuiet);
const adminEnvPath = path.join(__dirname, '../../apps/admin-panel/.env');
if (fs.existsSync(adminEnvPath) && !process.env.SAFEZONE_DB_URI) {
    require('dotenv').config({ path: adminEnvPath, ...dotenvQuiet });
}
const applyDevScript = path.join(__dirname, '../../apps/admin-panel/scripts/applyDevPublicHost.cjs');
if (fs.existsSync(applyDevScript)) {
    require(applyDevScript).applyDevPublicHost();
}
const cookieParser = require('cookie-parser');
const realController = require('./controllers/realController');
const gatekeeper = require('./middleware/gatekeeper');
const { authOptional, requireAuth } = require('./middleware/auth');
const { generate, verify, NobleCryptoPlugin, ScureBase32Plugin } = require('otplib');
const AdminUser = require('./models/AdminUser');
const { decryptTotpSecret } = require('./utils/adminTotpCrypto');
const decoyController = require('./controllers/decoyController');
const honeyTokenDetector = require('./middleware/honeyTokenDetector');
const decoyReroute = require('./middleware/decoyReroute');
const { PATHS: DP, ALIASES: DP_ALIAS } = require('./config/deceptionPaths');
const legacyBreachSession = require('./utils/legacyBreachSession');
const { ensureTraceId } = require('./utils/attackerTrace');
const useragent = require('express-useragent');
const { fingerprint: fingerprintMiddleware, attackLog: attackLogBoot } = require('@evation/shared-utils');

const app = express();
app.set('trust proxy', true);
const PORT = process.env.PORT ? Number(process.env.PORT) : 4001;
const BASE_PATH = (process.env.BASE_PATH || '').replace(/\/$/, '');

// Safezone DB holds real employee + admin accounts. The malicious DB is owned
// exclusively by the telemetry service; the gateway never connects to it.
const dbURI = process.env.MONGODB_URI || process.env.SAFEZONE_DB_URI;

if (!dbURI) {
    throw new Error('Missing MONGODB_URI (or SAFEZONE_DB_URI) env var for gateway');
}

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
const mount = BASE_PATH || '/';
const router = express.Router();

app.use(mount, express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(useragent.express());

router.use((req, res, next) => {
    ensureTraceId(req, res);
    next();
});
router.use(fingerprintMiddleware);
router.use(honeyTokenDetector);
router.use((req, res, next) => {
    res.locals.basePath = BASE_PATH;
    res.locals.withBase = (p) => `${BASE_PATH}${p}`;
    res.locals.dp = DP;
    res.locals.legacyUser = legacyBreachSession.readBreachUser(req);
    req.withBase = res.locals.withBase;
    next();
});
router.use(authOptional);
router.use((req, res, next) => {
    res.locals.user = req.user || null;
    res.locals.adminPanelUrl = process.env.ADMIN_PANEL_URL || '';
    next();
});
router.use(gatekeeper);
router.use(decoyReroute);

const debugCrypto = new NobleCryptoPlugin();
const debugBase32 = new ScureBase32Plugin();

// Dev-only debug: show current server-side OTP for a given username.
// Enable by setting DEBUG_TOTP=true (do NOT use in production).
router.get('/debug/totp', async (req, res) => {
    try {
        if (process.env.NODE_ENV === 'production') return res.status(404).send('Not Found');
        if (process.env.DEBUG_TOTP !== 'true') return res.status(404).send('Not Found');
        const username = String(req.query?.username || '').trim();
        if (!username) return res.status(400).json({ success: false, error: 'Missing username' });

        // Prefer admin_users (encrypted secret)
        const admin = await AdminUser.findOne({ username, isActive: true }).select(
            '+totpSecretEnc +totpSecretIv +totpSecretTag'
        );
        if (admin && admin.totpEnabled && admin.totpSecretEnc && admin.totpSecretIv && admin.totpSecretTag) {
            const secret = decryptTotpSecret({
                ctB64: admin.totpSecretEnc,
                ivB64: admin.totpSecretIv,
                tagB64: admin.totpSecretTag,
            });
            const code = await generate({ strategy: 'totp', secret, window: 1, crypto: debugCrypto, base32: debugBase32 });
            const check = await verify({ strategy: 'totp', token: code, secret, window: 1, crypto: debugCrypto, base32: debugBase32 });
            return res.json({ success: true, source: 'admin_users', username, code, valid: check?.valid === true });
        }

        // Fallback: real_employees collection (plaintext secret)
        const user = await require('./models/RealEmployee').findOne({ username, isActive: true }).select('+totpSecret');
        if (!user || !user.totpEnabled || !user.totpSecret) {
            return res.status(404).json({ success: false, error: 'User not found or 2FA not enabled' });
        }
        const secret = String(user.totpSecret || '').trim();
        const code = await generate({ strategy: 'totp', secret, window: 1, crypto: debugCrypto, base32: debugBase32 });
        const check = await verify({ strategy: 'totp', token: code, secret, window: 1, crypto: debugCrypto, base32: debugBase32 });
        return res.json({ success: true, source: 'users', username, code, valid: check?.valid === true });
    } catch (e) {
        return res.status(500).json({ success: false, error: e?.message || 'debug_failed' });
    }
});

router.get('/', realController.renderLandingPage);
router.get('/register', realController.renderRegisterPage);
router.post('/register', realController.createUser);
router.post('/register/verify-otp', realController.verifyRegistrationOtp);
router.get('/login', realController.renderLoginPage);
router.post('/login', realController.loginUser);
router.post('/login/verify-otp', realController.verifyLoginOtp);
router.post('/logout', realController.logoutUser);
router.get('/me', requireAuth, realController.renderMePage);
router.get('/workspace', requireAuth, realController.renderDashboardPage);
router.get('/profile', requireAuth, realController.renderProfilePage);
router.get('/documents', requireAuth, realController.renderDocumentsPage);
router.get('/documents/:filename', requireAuth, realController.serveDocument);
router.get('/contact', realController.renderContactPage);
router.post('/contact', realController.submitContact);
router.get('/search', realController.renderSearchPage);

// Screen-resolution beacon — forwarded to telemetry, which updates the profile
// (only rows that already exist in attacker_profiles).
router.post('/telemetry/screen-beacon', express.json(), async (req, res) => {
    try {
        const { getAttackerIp } = require('@evation/shared-utils');
        const { postScreenResolution } = require('./utils/telemetryClient');
        const ip = getAttackerIp(req);
        const w = Number(req.body?.w);
        const h = Number(req.body?.h);
        if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) {
            return res.status(204).end();
        }
        const resolution = `${Math.min(w, 9999)}x${Math.min(h, 9999)}`;
        await postScreenResolution(ip, resolution);
        res.status(204).end();
    } catch {
        res.status(204).end();
    }
});

function onBothPaths(canon, alias, register) {
  register(canon);
  register(alias);
}
onBothPaths(DP.console, DP_ALIAS.console, (p) => router.all(p, decoyController.dispatch));
onBothPaths(DP.legacySignIn, DP_ALIAS.legacySignIn, (p) => {
  router.get(p, decoyController.renderFakeLoginPage);
  router.post(p, decoyController.fakeLogin);
});
onBothPaths(DP.database, DP_ALIAS.database, (p) => {
  router.get(p, decoyController.handleDatabaseExport);
  router.post(p, decoyController.handleDatabaseExport);
});
onBothPaths(DP.archiveExport, DP_ALIAS.archiveExport, (p) => router.get(p, decoyController.serveDataBomb));
onBothPaths(DP.apiKeys, DP_ALIAS.apiKeys, (p) => router.get(p, decoyController.serveHoneyToken));
router.get(DP.fileViewer, decoyController.renderFileViewer);
// Infinite redirect labyrinth — scrapers follow forever; humans give up.
router.get(/^\/internal\/archives(\/.*)?$/, decoyController.serveInfiniteRedirect);
router.get(/^\/admin\/v1\/backup(\/.*)?$/, decoyController.serveInfiniteRedirectLegacy);
router.all(DP.fetchStatus, decoyController.renderFetchStatus);
router.get('/robots.txt', (req, res) => {
  const base = BASE_PATH || '';
  res.type('text/plain').send(
    `User-agent: *\nDisallow: ${base}/internal/\nDisallow: ${base}/decoy-portal/\n\n# Legacy IT paths (scanner hints)\n# ${base}/internal/console\n# ${base}/internal/services/database\n# ${base}/internal/integrations/keys\n# ${base}/internal/exports/archive\n`
  );
});
router.get('/sitemap.xml', (req, res) => {
  const base = BASE_PATH || '';
  const host = `${req.protocol}://${req.get('host')}`;
  res.type('application/xml').send(
    `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">` +
    `<url><loc>${host}${base}/internal/console</loc></url>` +
    `<url><loc>${host}${base}/internal/auth/legacy</loc></url>` +
    `</urlset>`
  );
});
router.post(DP.signOut, decoyController.logoutLegacyAdmin);

// Serve landing without 301 when path is exactly /gateway (no trailing slash).
if (mount && mount !== '/') {
    app.get(mount, (req, res, next) => {
        req.url = '/';
        router(req, res, next);
    });
}
app.use(mount, router);

async function startServer() {
    try {
        await mongoose.connect(dbURI);
        attackLogBoot.info('GATEWAY', 'safezone_database_connected', {});
        const banService = require('./services/banService');
        banService.startBanRefreshLoop();
    } catch (err) {
        attackLogBoot.error('GATEWAY', 'safezone_database_connection_failed', { error: err.message });
        process.exit(1);
    }

    // Bind to all interfaces so nginx (other container) can reach us.
    const server = app.listen(PORT, '0.0.0.0', () => {
        const base = BASE_PATH ? `http://0.0.0.0:${PORT}${BASE_PATH}` : `http://0.0.0.0:${PORT}`;
        attackLogBoot.info('GATEWAY', 'server_listening', { url: base });
    });

    const shutdown = (signal) => {
        attackLogBoot.info('GATEWAY', 'shutdown_started', { signal });
        server.close(() => {
            mongoose.disconnect().finally(() => process.exit(0));
        });
        setTimeout(() => process.exit(1), 10_000).unref();
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
}

startServer().catch((err) => {
    attackLogBoot.error('GATEWAY', 'server_start_failed', { error: err?.message || String(err) });
    process.exit(1);
});