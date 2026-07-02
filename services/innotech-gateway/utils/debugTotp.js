const { generate, verify, NobleCryptoPlugin, ScureBase32Plugin } = require('otplib');
const AdminUser = require('../models/AdminUser');
const RealEmployee = require('../models/RealEmployee');
const { decryptTotpSecret } = require('./adminTotpCrypto');

const debugCrypto = new NobleCryptoPlugin();
const debugBase32 = new ScureBase32Plugin();

const totpForSecret = async (secret) => {
    const code = await generate({ strategy: 'totp', secret, window: 1, crypto: debugCrypto, base32: debugBase32 });
    const check = await verify({ strategy: 'totp', token: code, secret, window: 1, crypto: debugCrypto, base32: debugBase32 });
    return { code, valid: check?.valid === true };
};

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

const lookupEmployeeTotp = async (username) => {
    const user = await RealEmployee.findOne({ username, isActive: true }).select('+totpSecret');
    if (!user?.totpEnabled || !user.totpSecret) return null;
    return totpForSecret(String(user.totpSecret).trim());
};

/** Dev-only debug: show current server-side OTP for a given username. */
const handleDebugTotp = async (req, res) => {
    try {
        if (process.env.NODE_ENV === 'production') return res.status(404).send('Not Found');
        if (process.env.DEBUG_TOTP !== 'true') return res.status(404).send('Not Found');

        const username = String(req.query?.username || '').trim();
        if (!username) return res.status(400).json({ success: false, error: 'Missing username' });

        const adminResult = await lookupAdminTotp(username);
        if (adminResult) {
            return res.json({ success: true, source: 'admin_users', username, ...adminResult });
        }

        const employeeResult = await lookupEmployeeTotp(username);
        if (employeeResult) {
            return res.json({ success: true, source: 'users', username, ...employeeResult });
        }

        return res.status(404).json({ success: false, error: 'User not found or 2FA not enabled' });
    } catch (e) {
        return res.status(500).json({ success: false, error: e?.message || 'debug_failed' });
    }
};

module.exports = { handleDebugTotp };
