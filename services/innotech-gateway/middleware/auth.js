const jwt = require('jsonwebtoken');
const crypto = require('crypto');

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
  return jwt.sign(payload, secret, { algorithm: 'HS256', expiresIn: '8h', issuer: 'innotech-gateway' });
}

function verifyAuthToken(token) {
  const secret = getJwtSecret();
  return jwt.verify(token, secret, { algorithms: ['HS256'], issuer: 'innotech-gateway' });
}

function authOptional(req, _res, next) {
  const token = req.cookies?.auth;
  if (!token) return next();
  try {
    req.user = verifyAuthToken(token);
  } catch {
    // Ignore invalid/expired tokens; treat as logged out.
  }
  next();
}

function requireAuth(req, res, next) {
  if (!req.user) return res.redirect(req.withBase('/login'));
  next();
}

function requireAdmin(req, res, next) {
  if (!req.user) return res.redirect(req.withBase('/login'));
  if (req.user.role !== 'admin') return res.status(403).send('Forbidden');
  next();
}

module.exports = { signAuthToken, authOptional, requireAuth, requireAdmin };

