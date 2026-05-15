'use strict';

/**
 * Honey Token Trap — hands out trackable fake credentials.
 *
 * Persists into Max's HoneyToken collection (fakeUsername / fakePassword /
 * isTriggered / triggeredLogs) so when the attacker reuses the token, it
 * can be matched and flagged elsewhere in the pipeline.
 *
 * NOTE: Max's TRAP_TYPES enum currently does not include HONEY_TOKEN, so
 * the closed-loop detector intentionally does NOT call LoggerService.logAttack
 * with that trapType (it would violate the schema enum). Instead, when a
 * honey credential is used, we append to HoneyToken.triggeredLogs directly.
 */

const { faker }            = require('@faker-js/faker');
const crypto               = require('crypto');
const mongoose             = require('mongoose');
const connectMaliciousDB   = require('../../logging-data-extraction/config/maliciousDb');
const HoneyTokenSchema     = require('../../logging-data-extraction/models/HoneyToken');

// In-memory cache so the detector middleware doesn't hit Mongo on every
// request. The DB remains the source of truth.
const memCache = new Map(); // apiKey OR jwt → { fakeUsername, _id }

function getIP(req) {
  return (
    req.threatInfo?.originIP ||
    req.headers['x-forwarded-for']?.split(',')[0].trim() ||
    req.headers['x-real-ip'] ||
    req.ip ||
    req.socket?.remoteAddress ||
    'unknown'
  );
}

function fakeJwt(user) {
  const b64 = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');
  const header  = b64({ alg: 'HS256', typ: 'JWT' });
  const payload = b64({
    sub:  user.id,
    name: user.name,
    role: 'admin',
    iat:  Math.floor(Date.now() / 1000),
    exp:  Math.floor(Date.now() / 1000) + 60 * 60 * 24,
  });
  const sig = crypto.randomBytes(32).toString('base64url');
  return `${header}.${payload}.${sig}`;
}

function getHoneyTokenModel() {
  try {
    const conn = connectMaliciousDB();
    return conn.models.HoneyToken || conn.model('HoneyToken', HoneyTokenSchema);
  } catch (err) {
    console.warn('[HoneyToken] Mongo unavailable, falling back to in-memory only:', err.message);
    return null;
  }
}

/**
 * Generate a new bait credential bundle and persist it.
 */
exports.generate = async (req) => {
  const user = {
    id:         faker.string.uuid(),
    name:       faker.person.fullName(),
    email:      faker.internet.email({ provider: 'innotech.io' }),
    department: faker.commerce.department(),
  };

  const apiKey = `itc_${faker.string.alphanumeric({ length: 32 })}`;
  const jwt    = fakeJwt(user);

  const bundle = {
    user,
    apiKey,
    jwt,
    issuedAt:  new Date().toISOString(),
    expiresIn: 86400,
    honey:     true,
    sourceIP:  getIP(req),
  };

  // Persist into Max's collection
  const HoneyToken = getHoneyTokenModel();
  if (HoneyToken) {
    try {
      const doc = await HoneyToken.create({
        fakeUsername: user.email,
        fakePassword: apiKey, // the bait — attackers will try this string
      });
      memCache.set(apiKey, { fakeUsername: user.email, _id: doc._id });
      memCache.set(jwt,    { fakeUsername: user.email, _id: doc._id });
    } catch (err) {
      console.error('[HoneyToken] persistence failed:', err.message);
      memCache.set(apiKey, { fakeUsername: user.email });
      memCache.set(jwt,    { fakeUsername: user.email });
    }
  } else {
    memCache.set(apiKey, { fakeUsername: user.email });
    memCache.set(jwt,    { fakeUsername: user.email });
  }

  console.log(`[HoneyToken] issued apiKey=${apiKey.slice(0, 12)}... to ${bundle.sourceIP}`);
  return bundle;
};

/**
 * @returns {boolean} true if this token value was previously issued
 */
exports.isHoney = async (value) => {
  if (!value) return false;
  if (memCache.has(value)) return true;

  const HoneyToken = getHoneyTokenModel();
  if (!HoneyToken) return false;
  try {
    const found = await HoneyToken.findOne({ fakePassword: value }).lean();
    if (found) {
      memCache.set(value, { fakeUsername: found.fakeUsername, _id: found._id });
      return true;
    }
  } catch (err) {
    console.error('[HoneyToken] lookup failed:', err.message);
  }
  return false;
};

/**
 * Append a usage record to HoneyToken.triggeredLogs.
 */
exports.recordUsage = async (value, ctx = {}) => {
  const HoneyToken = getHoneyTokenModel();
  if (!HoneyToken) return;
  try {
    await HoneyToken.updateOne(
      { fakePassword: value },
      {
        $set:  { isTriggered: true },
        $push: { triggeredLogs: {
          attackerIp:     ctx.attackerIp || 'unknown',
          networkContext: ctx.networkContext || 'HTTP',
        }},
      }
    );
  } catch (err) {
    console.error('[HoneyToken] recordUsage failed:', err.message);
  }
};
