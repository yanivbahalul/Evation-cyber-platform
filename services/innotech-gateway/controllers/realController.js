const User = require('../models/User'); 
const AdminUser = require('../models/AdminUser');
const bcrypt = require('bcryptjs'); // [cite: 22]
const { signAuthToken } = require('../middleware/auth');
const { TOTP, generateURI, verify, NobleCryptoPlugin, ScureBase32Plugin } = require('otplib');
const QRCode = require('qrcode');
const jwt = require('jsonwebtoken');
const { decryptTotpSecret } = require('../utils/adminTotpCrypto');

const cryptoPlugin = new NobleCryptoPlugin();
const base32Plugin = new ScureBase32Plugin();
const totp = new TOTP({ window: 1, crypto: cryptoPlugin, base32: base32Plugin });

function safeNext(next) {
    if (!next) return '/me';
    if (typeof next !== 'string') return '/me';
    if (!next.startsWith('/')) return '/me';
    if (next.startsWith('//')) return '/me';
    return next;
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

async function safeVerifyTotp(token, secret) {
    try {
        const s = String(secret || '').trim();
        if (!s) return false;
        const result = await verify({
            strategy: 'totp',
            token,
            secret: s,
            window: 1,
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
    res.render('index', { user: req.user || null, adminPanelUrl: process.env.ADMIN_PANEL_URL || 'http://localhost:3000' }); // [cite: 20]
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
            return res.status(400).send('Username must be 3-64 chars (letters, numbers, ., _, -)');
        }
        if (cleanPassword.length < 8 || cleanPassword.length > 200) {
            return res.status(400).send('Password must be 8-200 chars');
        }

        const existing = await User.findOne({ username: cleanUsername }).lean();
        if (existing) return res.status(409).send('Username already exists');

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(cleanPassword, salt); // [cite: 22]

        const newUser = new User({
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
        res.status(500).send('Error: ' + err.message);
    }
};

exports.verifyRegistrationOtp = async (req, res) => {
    try {
        const pre = req.cookies?.preauth || '';
        if (!pre.startsWith('reg:')) return res.status(401).send('Missing registration session');
        const userId = pre.slice(4);

        const otp = String(req.body?.otp || '').replace(/\s/g, '');
        if (!/^\d{6}$/.test(otp)) return res.status(400).send('OTP must be 6 digits');

        const user = await User.findById(userId).select('+totpSecret');
        if (!user || !user.totpSecret) return res.status(401).send('Invalid registration session');

        const ok = await safeVerifyTotp(otp, user.totpSecret);
        if (!ok) return res.status(401).send('Invalid OTP');

        user.totpEnabled = true;
        await user.save();

        // Auto-login after enrollment
        const token = signAuthToken({ sub: String(user._id), username: user.username, role: user.role });
        res.cookie('auth', token, {
            httpOnly: true,
            sameSite: 'lax',
            secure: process.env.NODE_ENV === 'production',
            path: '/',
            maxAge: 1000 * 60 * 60 * 8,
        });
        setPreAuthCookie(res, '', 0);
        res.redirect(req.withBase('/me'));
    } catch (err) {
        res.status(500).send('OTP verify error: ' + err.message);
    }
};

// Render the login page
exports.renderLoginPage = (req, res) => {
    res.render('login', { user: req.user || null, error: '', username: '' });
};

// Verify the user
exports.loginUser = async (req, res) => {
    try {
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
            if (!ok) return res.status(401).render('login', { user: null, error: 'Invalid credentials', username: cleanUsername });
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
            if (!ok) return res.status(401).render('login', { user: null, error: 'Invalid credentials', username: cleanUsername });
            if (!admin.totpEnabled) return res.status(401).render('login', { user: null, error: '2FA not enabled for this account', username: cleanUsername });
            setPreAuthCookie(res, `slogin:${admin._id}:${encodeURIComponent(next)}`, 1000 * 60 * 10);
            return res.render('login-otp', { user: null, username: admin.username, next });
        }

        // 3) Regular Safe Zone user login (gateway users collection)
        const user = await User.findOne({ username: cleanUsername, isActive: true }).select('+totpSecret');
        if (!user) return res.status(401).render('login', { user: null, error: 'Invalid credentials', username: cleanUsername });
        if (!await bcrypt.compare(cleanPassword, user.passwordHash)) return res.status(401).render('login', { user: null, error: 'Invalid credentials', username: cleanUsername });

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
        res.status(500).send('Login error: ' + err.message);
    }
};

exports.verifyLoginOtp = async (req, res) => {
    try {
        const pre = String(req.cookies?.preauth || '');
        if (!pre) return res.status(401).send('Missing login session');
        const parts = pre.split(':');
        const mode = parts[0];
        const userId = parts[1];
        const next = safeNext(parts.slice(2).join(':') ? decodeURIComponent(parts.slice(2).join(':')) : '/me');

        const otp = String(req.body?.otp || '').replace(/\s/g, '');
        if (!/^\d{6}$/.test(otp)) return res.status(400).send('OTP must be 6 digits');

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

            const jwtSecret = process.env.JWT_SECRET;
            if (!jwtSecret) return res.status(500).send('Server misconfiguration: missing JWT_SECRET');

            const exchange = jwt.sign(
                { sub: admin.username, purpose: 'exchange' },
                jwtSecret,
                { algorithm: 'HS256', expiresIn: '60s', issuer: 'innotech-gateway-exchange' }
            );
            setPreAuthCookie(res, '', 0);
            // Redirect to Next exchange endpoint, which sets the Blue Team cookie and redirects to '/'
            const adminOrigin = process.env.ADMIN_PANEL_URL || 'http://localhost:3000';
            return res.redirect(`${adminOrigin}/api/admin/exchange?token=${encodeURIComponent(exchange)}`);
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
            res.cookie('auth', token, {
                httpOnly: true,
                sameSite: 'lax',
                secure: process.env.NODE_ENV === 'production',
                path: '/',
                maxAge: 1000 * 60 * 60 * 8,
            });
            setPreAuthCookie(res, '', 0);
            return res.redirect(req.withBase(next));
        }

        // Regular Safe Zone OTP path
        if (mode !== 'login') return res.status(401).send('Missing login session');
        const user = await User.findById(userId).select('+totpSecret');
        if (!user || !user.isActive) return res.status(401).send('Invalid login session');
        if (!user.totpEnabled || !user.totpSecret) return res.status(401).send('2FA not enabled');

        const ok = await safeVerifyTotp(otp, user.totpSecret);
        if (!ok) return res.status(401).render('login-otp', { user: null, username: user.username, next, error: 'Invalid OTP. Check your authenticator time sync and retry.' });

        const token = signAuthToken({ sub: String(user._id), username: user.username, role: user.role });
        res.cookie('auth', token, {
            httpOnly: true,
            sameSite: 'lax',
            secure: process.env.NODE_ENV === 'production',
            path: '/',
            maxAge: 1000 * 60 * 60 * 8,
        });
        setPreAuthCookie(res, '', 0);
        res.redirect(req.withBase(next));
    } catch (err) {
        res.status(500).send('OTP verify error: ' + err.message);
    }
};

exports.logoutUser = async (req, res) => {
    res.cookie('auth', '', { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 0 });
    res.cookie('preauth', '', { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 0 });
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

    const documents = [
        { name: 'Employee Handbook (2026).pdf', type: 'PDF', updated: '2026-04-18' },
        { name: 'Remote Work Policy.pdf', type: 'PDF', updated: '2026-03-02' },
        { name: 'IT Onboarding Checklist.docx', type: 'DOCX', updated: '2026-02-11' },
        { name: 'Travel Expenses Form.xlsx', type: 'XLSX', updated: '2026-01-29' },
    ];

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
    const documents = [
        { name: 'Employee Handbook (2026).pdf', type: 'PDF', updated: '2026-04-18' },
        { name: 'Remote Work Policy.pdf', type: 'PDF', updated: '2026-03-02' },
        { name: 'IT Onboarding Checklist.docx', type: 'DOCX', updated: '2026-02-11' },
        { name: 'Travel Expenses Form.xlsx', type: 'XLSX', updated: '2026-01-29' },
        { name: 'Corporate VPN Client — Install Guide.pdf', type: 'PDF', updated: '2025-12-07' },
    ];

    res.render('documents', {
        user: req.user || null,
        adminPanelUrl: process.env.ADMIN_PANEL_URL || 'http://localhost:3000',
        documents,
    });
};

exports.renderContactPage = (req, res) => {
    res.render('contact', {
        user: req.user || null,
        adminPanelUrl: process.env.ADMIN_PANEL_URL || 'http://localhost:3000',
    });
};