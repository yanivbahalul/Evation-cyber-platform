const express = require('express');
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

const dotenvQuiet = { quiet: true };
require('dotenv').config(dotenvQuiet);
const adminEnvPath = path.join(__dirname, '../../apps/admin-panel/.env.local');
if (fs.existsSync(adminEnvPath) && !process.env.SAFEZONE_DB_URI) {
    require('dotenv').config({ path: adminEnvPath, ...dotenvQuiet });
}
require('../../apps/admin-panel/scripts/applyDevPublicHost.cjs').applyDevPublicHost();
const cookieParser = require('cookie-parser');
const realController = require('./controllers/realController'); // MVC: Logic is separated 
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
const attackerTraceMiddleware = require('./middleware/attackerTrace');
const useragent = require('express-useragent');
const fingerprintMiddleware = require('../logging-data-extraction/middlewares/fingerprint');

const app = express();
app.set('trust proxy', true);
const PORT = process.env.PORT ? Number(process.env.PORT) : 4001;
const BASE_PATH = (process.env.BASE_PATH || '').replace(/\/$/, '');

// 1. Database Connection (Secure Persistence) [cite: 21]
const dbURI = process.env.MONGODB_URI || process.env.SAFEZONE_DB_URI;

if (!dbURI) {
    throw new Error('Missing MONGODB_URI (or SAFEZONE_DB_URI) env var for gateway');
}

mongoose.connect(dbURI)
    .then(() => require('./utils/attackLog').info('GATEWAY', 'safezone_database_connected', {}))
    .catch((err) => {
        require('./utils/attackLog').error('GATEWAY', 'safezone_database_connection_failed', { error: err.message });
        process.exitCode = 1;
    });

// 2. Middleware & View Engine
app.set('view engine', 'ejs'); // Server-Side Rendering with EJS 
app.set('views', path.join(__dirname, 'views'));
const mount = BASE_PATH || '/';
const router = express.Router();

app.use(mount, express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(useragent.express());

router.use(attackerTraceMiddleware);
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
    res.locals.adminPanelUrl = process.env.ADMIN_PANEL_URL || 'http://localhost:3000';
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

        // Fallback: safezone users collection (plaintext secret)
        const user = await require('./models/User').findOne({ username, isActive: true }).select('+totpSecret');
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
router.get('/contact', realController.renderContactPage);
router.post('/contact', realController.submitContact);

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

app.listen(PORT, () => {
    const base = BASE_PATH ? `http://localhost:${PORT}${BASE_PATH}` : `http://localhost:${PORT}`;
    require('./utils/attackLog').info('GATEWAY', 'server_listening', { url: base });
});