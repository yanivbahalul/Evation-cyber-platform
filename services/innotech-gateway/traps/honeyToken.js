'use strict';

/**
 * Honey Token Trap — recognizes planted bait credentials.
 *
 * The fixed catalog (shared-constants) is the source of truth for what is
 * planted in the leaked artifacts (.env, .git/config, SQLi dump). The malicious
 * DB (owned by telemetry) mirrors the catalog for the SOC panel and stores
 * forensic usage. The gateway resolves provenance in-process from the catalog
 * and falls back to telemetry for any legacy/minted tokens.
 */

const { findHoneyToken } = require('@evation/shared-constants/honeyTokens');
const telemetry = require('../utils/telemetryClient');

/**
 * Resolve a presented value to its honey-token provenance.
 * @returns {Promise<null | {catalogId, fakeUsername, tokenType, service, scopes, leakSource, value}>}
 */
exports.resolve = async (value) => {
  if (!value) return null;

  const entry = findHoneyToken(value);
  if (entry) {
    return {
      catalogId: entry.catalogId,
      fakeUsername: entry.email,
      tokenType: entry.tokenType,
      service: entry.service,
      scopes: entry.scopes || [],
      leakSource: entry.leakSource,
      value: entry.value,
    };
  }

  const hit = await telemetry.checkHoneyToken(value);
  if (hit.hit) {
    return {
      catalogId: hit.catalogId,
      fakeUsername: hit.fakeUsername,
      tokenType: hit.tokenType,
      service: hit.service,
      scopes: hit.scopes || [],
      leakSource: hit.leakSource,
      value,
    };
  }
  return null;
};

/** @returns {Promise<boolean>} true if this value is a planted/issued honey-token. */
exports.isHoney = async (value) => Boolean(await exports.resolve(value));

/** Record usage of a honey-token value with forensic context. */
exports.recordUsage = async (value, ctx = {}) => {
  await telemetry.recordHoneyUsage(value, ctx);
};
