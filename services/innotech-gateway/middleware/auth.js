const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { authJwtExpiresIn } = require('../utils/authCookies');
const AdminUser = require('../models/AdminUser');
const RealEmployee = require('../models/RealEmployee');

let devEphemeralSecret = null;

function getJwtSecret() {
  const secret = process.env.GATEWAY_JWT_SECRET || process.env.JWT_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Missing GATEWAY_JWT_SECRET (or JWT_SECRET) env var for gateway auth');
    }
    if (!devEphemeralSecret) devEphemeralSecret = crypto.randomBytes(32).toString('hex');
    return devEphemeralSecret;
  }
  return secret;
}

function signAuthToken(payload) {
  const secret = getJwtSecret();
  return jwt.sign(payload, secret, {
    algorithm: 'HS256',
    expiresIn: authJwtExpiresIn(),
    issuer: 'innotech-gateway',
  });
}

function verifyAuthToken(token) {
  const secret = getJwtSecret();
  return jwt.verify(token, secret, { algorithms: ['HS256'], issuer: 'innotech-gateway' });
}

async function authOptional(req, res, next) {
  const token = req.cookies?.auth;
  if (token) {
    try {
      req.user = verifyAuthToken(token);
    } catch {
      // Ignore invalid/expired tokens; treat as logged out.
    }
  }
  try {
    await attachOpsAccess(req, res);
  } catch {
    res.locals.canAccessOps = false;
  }
  next();
}

async function operatorRoleForUsername(username) {
  if (!username) return false;
  const au = await AdminUser.findOne({ username, isActive: true }).select('role').lean();
  if (au) return au.role === 'admin';
  const u = await RealEmployee.findOne({ username, isActive: true }).select('role').lean();
  if (u) return u.role === 'admin';
  return false;
}

function sessionClaimsAdmin(req) {
  return String(req.user?.role || 'user') === 'admin';
}

/** Attack monitor nav — DB `admin` AND session role `admin` (blocks stale cookies / wrong JWT). */
async function attachOpsAccess(req, res) {
  res.locals.canAccessOps = false;

  if (req.user?.username) {
    const dbAdmin = await operatorRoleForUsername(req.user.username);
    res.locals.canAccessOps = dbAdmin && sessionClaimsAdmin(req);
    return;
  }

  const adminAuth = req.cookies?.admin_auth;
  const secret = process.env.JWT_SECRET;
  if (adminAuth && secret) {
    try {
      const payload = jwt.verify(adminAuth, secret, { algorithms: ['HS256'], issuer: 'innotech-honeynet' });
      if (payload.purpose === 'auth' && payload.sub) {
        res.locals.canAccessOps = await operatorRoleForUsername(payload.sub);
      }
    } catch {
      // ignore
    }
  }
}

function requireAuth(req, res, next) {
  if (!req.user) return res.redirect(req.withBase('/login'));
  next();
}

async function requireAdmin(req, res, next) {
  if (!req.user) return res.redirect(req.withBase('/login'));
  const name = req.user.username || String(req.user.sub || '');
  if (!name || !(await operatorRoleForUsername(name))) {
    return res.status(403).send('Forbidden');
  }
  next();
}

module.exports = { signAuthToken, authOptional, attachOpsAccess, requireAuth, requireAdmin, operatorRoleForUsername };
