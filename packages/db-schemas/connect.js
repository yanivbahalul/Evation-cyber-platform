'use strict';

const mongoose = require('mongoose');
const schemas = require('./index');

const DEFAULT_OPTIONS = {
  serverSelectionTimeoutMS: 2000,
  connectTimeoutMS: 2000,
  bufferCommands: false,
};

/**
 * Create an isolated Mongoose connection to the malicious telemetry DB with the
 * AttackerProfile / AttackEvent / HoneyToken models registered. This is the single
 * source of truth for the malicious-DB connection across services.
 *
 * @param {string} uri - MALICIOUS_DB_URI
 * @param {object} [options] - mongoose connection options (merged over defaults)
 * @returns {import('mongoose').Connection}
 */
function createMaliciousConnection(uri, options = {}) {
  if (!uri) throw new Error('Missing malicious DB URI');

  const conn = mongoose.createConnection(uri, { ...DEFAULT_OPTIONS, ...options });
  conn.model('AttackerProfile', schemas.AttackerProfileSchema);
  conn.model('AttackEvent', schemas.AttackEventSchema);
  conn.model('HoneyToken', schemas.HoneyTokenSchema);
  return conn;
}

module.exports = { createMaliciousConnection };
