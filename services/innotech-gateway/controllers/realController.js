const fs = require('fs');
const RealEmployee = require('../models/RealEmployee');
const { listPortalDocuments, resolvePortalDocument } = require('../config/portalDocuments');
const AdminUser = require('../models/AdminUser');
const bcrypt = require('bcryptjs');
const { signAuthToken } = require('../middleware/auth');
const { authCookieOptions, clearAllAuthCookies } = require('../utils/authCookies');
const { TOTP, generateURI, verify, NobleCryptoPlugin, ScureBase32Plugin } = require('otplib');
const QRCode = require('qrcode');
const jwt = require('jsonwebtoken');
const { decryptTotpSecret } = require('../utils/adminTotpCrypto');
const loginBruteTrap = require('../utils/loginBruteTrap');
const { attackLog } = require('@evation/shared-utils');
const { PATHS: DP } = require('../config/deceptionPaths');
const legacyBreachSession = require('../utils/legacyBreachSession');
const TRAP_TYPES = require('@evation/shared-constants');
const { report: reportTrap } = require('./decoyController');

async function failLogin(req, res, username, message) {
    attackLog.info('GATEWAY', 'login_failed', { username, ...attackLog.requestFields(req) });
    if (loginBruteTrap.shouldHandoffToDecoyLogin(req)) {
        const breachedAs = legacyBreachSession.establishBreachSession(res, { username: username || 'administrator' });
        attackLog.warn('GATEWAY', 'brute_force_breach_illusion', {
            trap: 'BRUTE_FORCE',
            username: breachedAs,
            ...attackLog.requestFields(req),
        });
        await reportTrap(TRAP_TYPES.BRUTE_FORCE, req, {
            payload: JSON.stringify({ handoff: 'breach_illusion', username: breachedAs }),
            handoffFrom: 'employee_login',
            wasted_time_ms: 0,
        });
        return res.redirect(302, req.withBase(`${DP.console}?breach=legacy`));
    }
    return res.status(401).render('login', { user: null, error: message, username: username || '' });
}

function markLoginSuccess(req) {
    loginBruteTrap.recordSuccess(req);
}

const cryptoPlugin = new NobleCryptoPlugin();
const base32Plugin = new ScureBase32Plugin();
const totp = new TOTP({ window: 1, crypto: cryptoPlugin, base32: base32Plugin });

function employeeHomePath() {
    return '/workspace';
}

function safeNext(next) {
    if (!next) return employeeHomePath();
    if (typeof next !== 'string') return employeeHomePath();
    if (!next.startsWith('/')) return employeeHomePath();
    if (next.startsWith('//')) return employeeHomePath();
    const normalized = next.replace(/\/$/, '') || next;
    if (
        normalized === '/dashboard' ||
        normalized.endsWith('/dashboard') ||
        normalized.includes('/gateway/dashboard')
    ) {
        return employeeHomePath();
    }
    return next;
}

/** Issue gateway + Blue Team cookies and redirect to Next /api/admin/exchange → /ops */
function finishBlueTeamOperatorLogin(req, res, { username, gatewaySub, gatewayRole = 'admin' }) {
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) return { error: 'Server misconfiguration. Please contact IT.' };

    const exchange = jwt.sign(
        { sub: username, purpose: 'exchange' },
        jwtSecret,
        { algorithm: 'HS256', expiresIn: '60s', issuer: 'innotech-gateway-exchange' }
    );
    const gatewayAuth = signAuthToken({
        sub: String(gatewaySub),
        username,
        role: gatewayRole,
    });
    res.cookie('auth', gatewayAuth, authCookieOptions('lax'));
    const homePath = '/gateway/workspace/';
    return {
        // Use a relative redirect so we stay on the current origin (works behind nginx, LAN IPs, and Cloudflare Tunnel).
        redirect: `/api/admin/exchange?token=${encodeURIComponent(exchange)}&next=${encodeURIComponent(homePath)}`,
    };
}

function setPreAuthCookie(res, value, maxAgeMs) {
    res.cookie('preauth', value, {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        maxAge: maxAgeMs,
    });
}

/** Drop Blue Team panel cookie so it cannot override a Safe Zone employee session. */
function clearAdminAuthCookie(res) {
    res.cookie('admin_auth', '', {
        httpOnly: true,
        sameSite: 'strict',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        maxAge: 0,
    });
}

async function safeVerifyTotp(token, secret) {
    try {
        const s = String(secret || '').trim();
        if (!s) return false;
        const envWindow = process.env.TOTP_WINDOW;
        const window = Number.isFinite(Number(envWindow))
            ? Math.max(0, Math.min(10, Math.floor(Number(envWindow))))
            : 2;
        const result = await verify({
            strategy: 'totp',
            token,
            secret: s,
            window,
            crypto: cryptoPlugin,
            base32: base32Plugin,
        });
        return result && typeof result === 'object' && result.valid === true;
    } catch {
        return false;
    }
}

// 1. Landing Page logic
exports.renderLandingPage = (req, res) => {
    res.render('index', { user: req.user || null, adminPanelUrl: process.env.ADMIN_PANEL_URL || 'http://localhost:3000' });
};

// 2. Registration Page logic
exports.renderRegisterPage = (req, res) => {
    res.render('register', { user: req.user || null });
};

// 3. Create User logic
exports.createUser = async (req, res) => {
    try {
        const { username, password } = req.body;
        const cleanUsername = (username || '').trim();
        const cleanPassword = password || '';

        if (!/^[a-zA-Z0-9._-]{3,64}$/.test(cleanUsername)) {
            return res.status(400).render('register', { user: null, error: 'Username must be 3-64 chars (letters, numbers, ., _, -)', username: cleanUsername });
        }
        if (cleanPassword.length < 8 || cleanPassword.length > 200) {
            return res.status(400).render('register', { user: null, error: 'Password must be 8-200 chars', username: cleanUsername });
        }

        const existing = await RealEmployee.findOne({ username: cleanUsername }).lean();
        if (existing) return res.status(409).render('register', { user: null, error: 'Username already exists', username: cleanUsername });

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(cleanPassword, salt);

        const newUser = new RealEmployee({
            username: cleanUsername,
            passwordHash: hashedPassword,
            role: 'user',
            isActive: true,
        });

        // Per-user 2FA secret + QR (unique per user).
        const secret = totp.generateSecret();
        newUser.totpSecret = secret;
        newUser.totpEnabled = false;

        await newUser.save();

        const issuer = process.env.TOTP_ISSUER_NAME || 'InnoTech Safe Zone';
        const otpauth = generateURI({ strategy: 'totp', label: cleanUsername, issuer, secret });
        const qrDataUrl = await QRCode.toDataURL(otpauth, { margin: 1, scale: 6 });

        setPreAuthCookie(res, `reg:${newUser._id}`, 1000 * 60 * 10);
        res.render('setup-2fa', { user: null, username: cleanUsername, qrDataUrl, otpauth });
    } catch (err) {
        res.status(500).render('register', { user: null, error: 'Registration error. Please try again.', username: '' });
    }
};

exports.verifyRegistrationOtp = async (req, res) => {
    try {
        const pre = req.cookies?.preauth || '';
        if (!pre.startsWith('reg:')) {
            return res.status(401).render('register', { user: null, error: 'Registration session expired. Please register again.', username: '' });
        }
        const userId = pre.slice(4);

        const otp = String(req.body?.otp || '').replace(/\s/g, '');
        if (!/^\d{6}$/.test(otp)) {
            const user = await RealEmployee.findById(userId).select('+totpSecret');
            if (!user || !user.totpSecret) return res.status(401).render('register', { user: null, error: 'Invalid registration session. Please register again.', username: '' });
            const issuer = process.env.TOTP_ISSUER_NAME || 'InnoTech Safe Zone';
            const otpauth = generateURI({ strategy: 'totp', label: user.username, issuer, secret: user.totpSecret });
            const qrDataUrl = await QRCode.toDataURL(otpauth, { margin: 1, scale: 6 });
            return res.status(400).render('setup-2fa', { user: null, username: user.username, qrDataUrl, otpauth, error: 'OTP must be 6 digits' });
        }

        const user = await RealEmployee.findById(userId).select('+totpSecret');
        if (!user || !user.totpSecret) {
            return res.status(401).render('register', { user: null, error: 'Invalid registration session. Please register again.', username: '' });
        }

        const ok = await safeVerifyTotp(otp, user.totpSecret);
        if (!ok) {
            const issuer = process.env.TOTP_ISSUER_NAME || 'InnoTech Safe Zone';
            const otpauth = generateURI({ strategy: 'totp', label: user.username, issuer, secret: user.totpSecret });
            const qrDataUrl = await QRCode.toDataURL(otpauth, { margin: 1, scale: 6 });
            return res.status(401).render('setup-2fa', { user: null, username: user.username, qrDataUrl, otpauth, error: 'Invalid OTP. Check your authenticator time sync and retry.' });
        }

        user.totpEnabled = true;
        await user.save();

        // Auto-login after enrollment
        const token = signAuthToken({ sub: String(user._id), username: user.username, role: user.role });
        clearAdminAuthCookie(res);
        res.cookie('auth', token, authCookieOptions('lax'));
        setPreAuthCookie(res, '', 0);
        res.redirect(req.withBase('/me'));
    } catch (err) {
        res.status(500).render('register', { user: null, error: 'OTP verification error. Please try again.', username: '' });
    }
};

// Employee / operator sign-in (Safe Zone UI — served via Next rewrite at /gateway/login).
exports.renderLoginPage = (req, res) => {
    res.render('login', { user: req.user || null, error: '', username: '' });
};

// Verify the user
exports.loginUser = async (req, res) => {
    if (req.trapHandled || res.headersSent) return;
    try {
        clearAllAuthCookies(res);
        const { username, password } = req.body;
        const cleanUsername = (username || '').trim();
        const cleanPassword = password || '';
        const next = safeNext(req.query?.next);

        // 1) Admin login through the gateway (same /gateway/login UI)
        // If user exists in admin_users with role=admin, we OTP there then hand-off to the Blue Team dashboard.
        const admin = await AdminUser.findOne({ username: cleanUsername, isActive: true })
            .select('+totpSecretEnc +totpSecretIv +totpSecretTag');
        if (admin && admin.role === 'admin') {
            const ok = typeof admin.passwordHash === 'string' && admin.passwordHash.length > 0
                ? await bcrypt.compare(cleanPassword, admin.passwordHash)
                : false;
            if (!ok) return await failLogin(req, res, cleanUsername, 'Invalid credentials');
            markLoginSuccess(req);
            if (!admin.totpEnabled) return res.status(401).render('login', { user: null, error: '2FA not enabled for this account', username: cleanUsername });
            setPreAuthCookie(res, `admin:${admin._id}:${encodeURIComponent(next)}`, 1000 * 60 * 10);
            return res.render('login-otp', { user: null, username: admin.username, next });
        }

        // 2) Regular user stored in admin_users (role=user)
        // Some demo setups keep employees in the same collection as admins (with encrypted TOTP at rest).
        if (admin && admin.role !== 'admin') {
            const ok = typeof admin.passwordHash === 'string' && admin.passwordHash.length > 0
                ? await bcrypt.compare(cleanPassword, admin.passwordHash)
                : false;
            if (!ok) return await failLogin(req, res, cleanUsername, 'Invalid credentials');
            markLoginSuccess(req);
            if (!admin.totpEnabled) return res.status(401).render('login', { user: null, error: '2FA not enabled for this account', username: cleanUsername });
            setPreAuthCookie(res, `slogin:${admin._id}:${encodeURIComponent(next)}`, 1000 * 60 * 10);
            return res.render('login-otp', { user: null, username: admin.username, next });
        }

        // 3) Regular Safe Zone user login (gateway users collection)
        const user = await RealEmployee.findOne({ username: cleanUsername, isActive: true }).select('+totpSecret');
        if (!user) return await failLogin(req, res, cleanUsername, 'Invalid credentials');
        if (!await bcrypt.compare(cleanPassword, user.passwordHash)) return await failLogin(req, res, cleanUsername, 'Invalid credentials');
        markLoginSuccess(req);

        // If user has 2FA enabled, require OTP step.
        if (user.totpEnabled) {
            setPreAuthCookie(res, `login:${user._id}:${encodeURIComponent(next)}`, 1000 * 60 * 10);
            return res.render('login-otp', { user: null, username: user.username, next });
        }

        // If user does not have 2FA enabled yet, force enrollment.
        if (!user.totpSecret) {
            user.totpSecret = totp.generateSecret();
            await user.save();
        }
        const issuer = process.env.TOTP_ISSUER_NAME || 'InnoTech Safe Zone';
        const otpauth = generateURI({ strategy: 'totp', label: user.username, issuer, secret: user.totpSecret });
        const qrDataUrl = await QRCode.toDataURL(otpauth, { margin: 1, scale: 6 });
        setPreAuthCookie(res, `reg:${user._id}`, 1000 * 60 * 10);
        return res.render('setup-2fa', { user: null, username: user.username, qrDataUrl, otpauth });
    } catch (err) {
        res.status(500).render('login', { user: null, error: 'Login error. Please try again.', username: '' });
    }
};

exports.verifyLoginOtp = async (req, res) => {
    try {
        const pre = String(req.cookies?.preauth || '');
        if (!pre) return res.status(401).render('login', { user: null, error: 'Missing login session. Please sign in again.', username: '' });
        const parts = pre.split(':');
        const mode = parts[0];
        const userId = parts[1];
        const next = safeNext(parts.slice(2).join(':') ? decodeURIComponent(parts.slice(2).join(':')) : '/me');

        const otp = String(req.body?.otp || '').replace(/\s/g, '');
        if (!/^\d{6}$/.test(otp)) return res.status(400).render('login-otp', { user: null, username: '', next, error: 'OTP must be 6 digits' });

        // Admin OTP path → exchange into Blue Team dashboard
        if (mode === 'admin') {
            const admin = await AdminUser.findById(userId).select('+totpSecretEnc +totpSecretIv +totpSecretTag');
            if (!admin || !admin.isActive || admin.role !== 'admin') return res.status(401).render('login', { user: null, error: 'Invalid login session. Please sign in again.', username: '' });
            if (!admin.totpEnabled) return res.status(401).render('login', { user: null, error: '2FA not enabled for this account', username: admin.username });
            if (!admin.totpSecretEnc || !admin.totpSecretIv || !admin.totpSecretTag) return res.status(401).render('login', { user: null, error: '2FA not enrolled. Please re-enroll.', username: admin.username });

            const secret = decryptTotpSecret({
                ctB64: admin.totpSecretEnc,
                ivB64: admin.totpSecretIv,
                tagB64: admin.totpSecretTag,
            });
            const ok = await safeVerifyTotp(otp, secret);
            if (!ok) return res.status(401).render('login-otp', { user: null, username: admin.username, next, error: 'Invalid OTP. Check your authenticator time sync and retry.' });

            setPreAuthCookie(res, '', 0);
            const out = finishBlueTeamOperatorLogin(req, res, {
                username: admin.username,
                gatewaySub: admin._id,
                gatewayRole: 'admin',
            });
            if (out.error) return res.status(500).render('login-otp', { user: null, username: admin.username, next, error: out.error });
            return res.redirect(out.redirect);
        }

        // Regular user (stored in admin_users) OTP path → issue gateway auth cookie and go to Safe Zone
        if (mode === 'slogin') {
            const u = await AdminUser.findById(userId).select('+totpSecretEnc +totpSecretIv +totpSecretTag');
            if (!u || !u.isActive || u.role === 'admin') return res.status(401).render('login', { user: null, error: 'Invalid login session. Please sign in again.', username: '' });
            if (!u.totpEnabled) return res.status(401).render('login', { user: null, error: '2FA not enabled for this account', username: u?.username || '' });
            if (!u.totpSecretEnc || !u.totpSecretIv || !u.totpSecretTag) return res.status(401).render('login', { user: null, error: '2FA not enrolled. Please re-enroll.', username: u.username });

            const secret = decryptTotpSecret({
                ctB64: u.totpSecretEnc,
                ivB64: u.totpSecretIv,
                tagB64: u.totpSecretTag,
            });
            const ok = await safeVerifyTotp(otp, secret);
            if (!ok) return res.status(401).render('login-otp', { user: null, username: u.username, next, error: 'Invalid OTP. Check your authenticator time sync and retry.' });

            const token = signAuthToken({ sub: String(u._id), username: u.username, role: u.role || 'user' });
            clearAdminAuthCookie(res);
            res.cookie('auth', token, authCookieOptions('lax'));
            setPreAuthCookie(res, '', 0);
            return res.redirect(req.withBase(next));
        }

        // Regular Safe Zone OTP path
        if (mode !== 'login') return res.status(401).render('login', { user: null, error: 'Missing login session. Please sign in again.', username: '' });
        const user = await RealEmployee.findById(userId).select('+totpSecret');
        if (!user || !user.isActive) return res.status(401).render('login', { user: null, error: 'Invalid login session. Please sign in again.', username: '' });
        if (!user.totpEnabled || !user.totpSecret) return res.status(401).render('login', { user: null, error: '2FA not enabled for this account.', username: user?.username || '' });

        const ok = await safeVerifyTotp(otp, user.totpSecret);
        if (!ok) return res.status(401).render('login-otp', { user: null, username: user.username, next, error: 'Invalid OTP. Check your authenticator time sync and retry.' });

        setPreAuthCookie(res, '', 0);
        // Operator stored in Safe Zone `users` with role=admin → Blue Team /ops (not employee dashboard only)
        if (user.role === 'admin') {
            const out = finishBlueTeamOperatorLogin(req, res, {
                username: user.username,
                gatewaySub: user._id,
                gatewayRole: 'admin',
            });
            if (out.error) return res.status(500).render('login-otp', { user: null, username: user.username, next, error: out.error });
            return res.redirect(out.redirect);
        }

        const token = signAuthToken({ sub: String(user._id), username: user.username, role: user.role || 'user' });
        clearAdminAuthCookie(res);
        res.cookie('auth', token, authCookieOptions('lax'));
        res.redirect(req.withBase(next));
    } catch (err) {
        res.status(500).render('login', { user: null, error: 'OTP verification error. Please try again.', username: '' });
    }
};

exports.logoutUser = async (req, res) => {
    clearAllAuthCookies(res);
    res.redirect(req.withBase('/'));
};

exports.renderMePage = (req, res) => {
    res.render('me', { user: req.user || null, adminPanelUrl: process.env.ADMIN_PANEL_URL || 'http://localhost:3000' });
};

exports.renderDashboardPage = (req, res) => {
    const announcements = [
        {
            title: 'Scheduled maintenance',
            body: 'VPN will be unavailable on Sunday 02:00–03:00 (UTC+3).',
        },
        {
            title: 'Security policy update',
            body: '2FA is required for remote access starting next week.',
        },
        {
            title: 'Payroll',
            body: 'April payslips are now available in the Documents section.',
        },
    ];

    const tasks = [
        { title: 'Read & acknowledge the updated Information Security Policy', status: 'Pending' },
        { title: 'Submit monthly timesheet (April)', status: 'Pending' },
        { title: 'Update emergency contact details', status: 'In Review' },
        { title: 'Complete mandatory “Phishing Awareness” training', status: 'Pending' },
        { title: 'Confirm home address for payroll', status: 'Done' },
    ];

    const documents = listPortalDocuments();

    res.render('dashboard', {
        user: req.user || null,
        adminPanelUrl: process.env.ADMIN_PANEL_URL || 'http://localhost:3000',
        announcements,
        tasks,
        documents,
    });
};

exports.renderProfilePage = (req, res) => {
    const username = req.user?.username || 'Employee';
    const profileRows = [
        { label: 'Full name', value: username.replace(/[._-]/g, ' ') },
        { label: 'Department', value: 'Finance' },
        { label: 'Email', value: `${String(username).toLowerCase()}@innotech.local` },
        { label: 'Manager', value: 'Dana Levi' },
        { label: 'Office', value: 'HQ — 3rd floor' },
    ];

    res.render('profile', {
        user: req.user || null,
        adminPanelUrl: process.env.ADMIN_PANEL_URL || 'http://localhost:3000',
        profileRows,
    });
};

exports.renderDocumentsPage = (req, res) => {
    res.render('documents', {
        user: req.user || null,
        adminPanelUrl: process.env.ADMIN_PANEL_URL || 'http://localhost:3000',
        documents: listPortalDocuments(),
    });
};

exports.serveDocument = (req, res) => {
    const doc = resolvePortalDocument(req.params.filename);
    if (!doc || !fs.existsSync(doc.filePath)) {
        return res.status(404).send('Document not found');
    }
    res.type(doc.mime);
    res.setHeader('Content-Disposition', `inline; filename="${doc.name.replace(/"/g, '')}"`);
    return res.sendFile(doc.filePath);
};

exports.renderContactPage = (req, res) => {
    res.render('contact', {
        user: req.user || null,
        adminPanelUrl: process.env.ADMIN_PANEL_URL || 'http://localhost:3000',
        success: false,
        formError: '',
    });
};

const SEARCH_DIRECTORY = [
    { name: 'Dana Cohen',     email: 'dana.cohen@innotech.local',    department: 'Finance',     office: 'HQ — 3rd floor' },
    { name: 'Ofir Cohen',     email: 'ofir.cohen@innotech.local',    department: 'R&D',         office: 'HQ — 5th floor' },
    { name: 'Maya Levi',      email: 'maya.levi@innotech.local',     department: 'HR',          office: 'HQ — 2nd floor' },
    { name: 'Tomer Bar',      email: 'tomer.bar@innotech.local',     department: 'IT',          office: 'HQ — 4th floor' },
    { name: 'Noa Friedman',   email: 'noa.f@innotech.local',         department: 'Finance',     office: 'Branch — TLV' },
    { name: 'Eitan Mizrahi',  email: 'eitan.m@innotech.local',       department: 'Operations',  office: 'HQ — 1st floor' },
    { name: 'Shira Azulay',   email: 'shira.a@innotech.local',       department: 'Marketing',   office: 'HQ — 4th floor' },
    { name: 'Yossi Peretz',   email: 'yossi.p@innotech.local',       department: 'R&D',         office: 'Branch — Haifa' },
];

function escapeHtml(s) {
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

exports.renderSearchPage = (req, res) => {
    if (req.trapHandled || res.headersSent) return;
    const query = String(req.query?.q || '').trim();
    const needle = query.toLowerCase();
    const results = !needle
        ? []
        : SEARCH_DIRECTORY.filter((row) =>
            row.name.toLowerCase().includes(needle) ||
            row.email.toLowerCase().includes(needle) ||
            row.department.toLowerCase().includes(needle)
        );

    res.render('search', {
        user: req.user || null,
        adminPanelUrl: process.env.ADMIN_PANEL_URL || 'http://localhost:3000',
        query,
        queryHtml: escapeHtml(query),
        results,
    });
};

exports.submitContact = (req, res) => {
    if (req.trapHandled || res.headersSent) return;
    res.render('contact', {
        user: req.user || null,
        adminPanelUrl: process.env.ADMIN_PANEL_URL || 'http://localhost:3000',
        success: true,
        formError: '',
        subject: req.body?.subject || '',
        message: req.body?.message || '',
    });
};