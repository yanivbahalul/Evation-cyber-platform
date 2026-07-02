const { generate, verify, NobleCryptoPlugin, ScureBase32Plugin } = require('otplib');
const AdminUser = require('../models/AdminUser');
const RealEmployee = require('../models/RealEmployee');
const { decryptTotpSecret } = require('./adminTotpCrypto');

const debugCrypto = new NobleCryptoPlugin();
const debugBase32 = new ScureBase32Plugin();

/** Generate and self-verify a TOTP code for the given secret. */
const totpForSecret = async (secret) => {
    const code = await generate({ strategy: 'totp', secret, window: 1, crypto: debugCrypto, base32: debugBase32 });
    const check = await verify({ strategy: 'totp', token: code, secret, window: 1, crypto: debugCrypto, base32: debugBase32 });
    return { code, valid: check?.valid === true };
};

/** Look up an active admin user's encrypted TOTP secret and return a live code. */
const lookupAdminTotp = async (username) => {
    const admin = await AdminUser.findOne({ username, isActive: true }).select(
        '+totpSecretEnc +totpSecretIv +totpSecretTag'
    );
    if (!admin?.totpEnabled || !admin.totpSecretEnc || !admin.totpSecretIv || !admin.totpSecretTag) {
        return null;
    }
    const secret = decryptTotpSecret({
        ctB64: admin.totpSecretEnc,
        ivB64: admin.totpSecretIv,
        tagB64: admin.totpSecretTag,
    });
    return totpForSecret(secret);
};

/** Look up an active employee's plaintext TOTP secret and return a live code. */
const lookupEmployeeTotp = async (username) => {
    const user = await RealEmployee.findOne({ username, isActive: true }).select('+totpSecret');
    if (!user?.totpEnabled || !user.totpSecret) return null;
    return totpForSecret(String(user.totpSecret).trim());
};

/** True when the DEBUG_TOTP debug endpoint is allowed in this environment. */
const isDebugTotpEnabled = () =>
    process.env.NODE_ENV !== 'production' && process.env.DEBUG_TOTP === 'true';

/** Resolve a username to a TOTP code from admin_users or real_employees. */
const resolveDebugTotp = async (username) => {
    const adminResult = await lookupAdminTotp(username);
    if (adminResult) return { source: 'admin_users', ...adminResult };

    const employeeResult = await lookupEmployeeTotp(username);
    if (employeeResult) return { source: 'users', ...employeeResult };

    return null;
};

/** Run the debug lookup and write the HTTP response. */
const serveDebugTotp = async (req, res) => {
    const username = String(req.query?.username || '').trim();
    if (!username) return res.status(400).json({ success: false, error: 'Missing username' });

    const result = await resolveDebugTotp(username);
    if (!result) {
        return res.status(404).json({ success: false, error: 'User not found or 2FA not enabled' });
    }

    return res.json({ success: true, username, ...result });
};

/** Dev-only debug: show current server-side OTP for a given username. */
const handleDebugTotp = async (req, res) => {
    if (!isDebugTotpEnabled()) return res.status(404).send('Not Found');
    try {
        return await serveDebugTotp(req, res);
    } catch (e) {
        return res.status(500).json({ success: false, error: e?.message || 'debug_failed' });
    }
};

module.exports = { handleDebugTotp };
