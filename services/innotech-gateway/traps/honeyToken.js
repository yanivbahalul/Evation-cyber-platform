'use strict';

/**
 * Honey Token Trap — hands out trackable fake credentials.
 *
 * The HoneyToken collection lives in the malicious DB, which only the telemetry
 * service touches. This trap persists/looks-up/records via telemetry HTTP and
 * keeps an in-process cache so the hot-path detector avoids a network round-trip
 * for tokens issued during this process lifetime.
 */

const { faker } = require('@faker-js/faker');
const crypto = require('crypto');
const { getAttackerIp } = require('@evation/shared-utils');
const telemetry = require('../utils/telemetryClient');

// apiKey OR jwt → fakeUsername. Telemetry remains the source of truth across restarts.
const memCache = new Map();

function fakeJwt(user) {
  const b64 = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');
  const header = b64({ alg: 'HS256', typ: 'JWT' });
  const payload = b64({
    sub: user.id,
    name: user.name,
    role: 'admin',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24,
  });
  const sig = crypto.randomBytes(32).toString('base64url');
  return `${header}.${payload}.${sig}`;
}

/** Generate a new bait credential bundle and persist it via telemetry. */
exports.generate = async (req) => {
  const user = {
    id: faker.string.uuid(),
    name: faker.person.fullName(),
    email: faker.internet.email({ provider: 'innotech.io' }),
    department: faker.commerce.department(),
  };

  const apiKey = `itc_${faker.string.alphanumeric({ length: 32 })}`;
  const jwt = fakeJwt(user);

  await telemetry.generateHoneyToken({ fakeUsername: user.email, fakePassword: apiKey });
  memCache.set(apiKey, user.email);
  memCache.set(jwt, user.email);

  return {
    user,
    apiKey,
    jwt,
    issuedAt: new Date().toISOString(),
    expiresIn: 86400,
    honey: true,
    sourceIP: getAttackerIp(req),
  };
};

/** @returns {Promise<boolean>} true if this value was previously issued as a honey-token. */
exports.isHoney = async (value) => {
  if (!value) return false;
  if (memCache.has(value)) return true;

  const { hit, fakeUsername } = await telemetry.checkHoneyToken(value);
  if (hit) {
    memCache.set(value, fakeUsername);
    return true;
  }
  return false;
};

/** Record usage of a honey-token value. */
exports.recordUsage = async (value, ctx = {}) => {
  await telemetry.recordHoneyUsage(value, ctx);
};
