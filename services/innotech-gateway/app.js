const express = require('express');
const mongoose = require('mongoose');
require('dotenv').config();
const cookieParser = require('cookie-parser');
const path = require('path');
const realController = require('./controllers/realController'); // MVC: Logic is separated 
const gatekeeper = require('./middleware/gatekeeper');
const { authOptional, requireAuth } = require('./middleware/auth');
const { generate, verify, NobleCryptoPlugin, ScureBase32Plugin } = require('otplib');
const AdminUser = require('./models/AdminUser');
const { decryptTotpSecret } = require('./utils/adminTotpCrypto');
const decoyController = require('./controllers/decoyController');
const honeyTokenDetector = require('./middleware/honeyTokenDetector');

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
    .then(() => console.log('Connected to Safe Zone Database'))
    .catch((err) => {
        console.error('Database Connection Error:', err);
        process.exitCode = 1;
    });

// 2. Middleware & View Engine
app.set('view engine', 'ejs'); // Server-Side Rendering with EJS 
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public'))); // For CSS3 files 
app.use(express.json()); // Parses incoming JSON payloads
app.use(express.urlencoded({ extended: true })); // Parses form data
app.use(cookieParser());
app.use(honeyTokenDetector);
app.use((req, res, next) => {
    res.locals.basePath = BASE_PATH;
    res.locals.withBase = (path) => `${BASE_PATH}${path}`;
    req.withBase = res.locals.withBase;
    next();
});
app.use(authOptional);
app.use((req, res, next) => {
    res.locals.user = req.user || null;
    res.locals.adminPanelUrl = process.env.ADMIN_PANEL_URL || 'http://localhost:3000';
    next();
});
app.use(gatekeeper);

const debugCrypto = new NobleCryptoPlugin();
const debugBase32 = new ScureBase32Plugin();

// Dev-only debug: show current server-side OTP for a given username.
// Enable by setting DEBUG_TOTP=true (do NOT use in production).
app.get('/debug/totp', async (req, res) => {
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

// 3. Routes (The "Safe Zone" Endpoints) 
app.get('/', realController.renderLandingPage);
app.get('/register', realController.renderRegisterPage);
app.post('/register', realController.createUser); // Handles bcrypt hashing [cite: 22]
app.post('/register/verify-otp', realController.verifyRegistrationOtp);
app.get('/login', realController.renderLoginPage);
app.post('/login', realController.loginUser);
app.post('/login/verify-otp', realController.verifyLoginOtp);
app.post('/logout', realController.logoutUser);
app.get('/me', requireAuth, realController.renderMePage);
app.get('/dashboard', requireAuth, realController.renderDashboardPage);
app.get('/profile', requireAuth, realController.renderProfilePage);
app.get('/documents', requireAuth, realController.renderDocumentsPage);
app.get('/contact', realController.renderContactPage);

// Decoy Controller — dispatches to the right trap based on req.threatInfo.type
app.all('/decoy-portal', decoyController.dispatch);

// Direct trap routes (triggered by URL, not by signature detection)
app.post('/decoy-portal/login',       decoyController.fakeLogin);
app.get ('/decoy-portal/data-bomb',   decoyController.serveDataBomb);
app.get ('/decoy-portal/honey-token', decoyController.serveHoneyToken);

// 4. Start Server
app.listen(PORT, () => {
    console.log(`InnoTech Gateway running on http://localhost:${PORT}`);
});