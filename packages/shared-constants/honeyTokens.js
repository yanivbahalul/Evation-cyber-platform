'use strict';

/**
 * Fixed catalog of planted honey tokens (shared by gateway + telemetry).
 *
 * Values are deliberately STABLE so the exact same bait credential appears in
 * every leaked artifact (.env, .git/config, SQLi dump) and is recognized when
 * an attacker later uses it. Nothing here is real — these are decoy credentials
 * used purely for deception and telemetry/provenance.
 *
 * Each entry:
 *   catalogId  - stable id, used to upsert/seed without duplicating rows
 *   tokenType  - api_key | aws_key | db_uri | jwt
 *   value      - the primary secret string an attacker would present
 *   secret     - optional secondary secret (e.g. AWS secret access key)
 *   service    - the service account / system the credential belongs to
 *   email      - service-account identity (shown in SOC + artifacts)
 *   scopes     - granted scopes; the realistic API enforces these
 *   leakSource - human label of where it was planted (provenance)
 *   endpoints  - decoy API paths this credential is "meant" for
 */

const HONEY_TOKENS = Object.freeze([
  Object.freeze({
    catalogId: 'hr-api-key',
    tokenType: 'api_key',
    value: 'itc_live_8f3c9a2b7e1d4f60a5c8b9d2e3f10472',
    service: 'hr-integration',
    email: 'hr.integration@innotech.io',
    scopes: ['hr:read'],
    leakSource: 'backup .env (config/.env)',
    endpoints: ['/internal/api/v1/hr/export'],
  }),
  Object.freeze({
    catalogId: 'monitoring-jwt',
    tokenType: 'jwt',
    value:
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJzdmMtbW9uaXRvcmluZyIsIm5hbWUiOiJNb25pdG9yaW5nIEFnZW50Iiwicm9sZSI6ImFkbWluIiwic2NvcGUiOiJtZXRyaWNzOnJlYWQiLCJpYXQiOjE3MTU4MDAwMDB9.r5C8m2Qe1x_kPv0bN3sWl9Tfdq7hZgJyU4aoX1cV2bE',
    service: 'monitoring-agent',
    email: 'monitoring.agent@innotech.io',
    scopes: ['metrics:read'],
    leakSource: 'backup .env (config/.env)',
    endpoints: ['/internal/api/v1/hr/export'],
  }),
  Object.freeze({
    catalogId: 'aws-backup-key',
    tokenType: 'aws_key',
    value: 'AKIA5INNOTECHBKUP01X',
    secret: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
    service: 'backup-s3',
    email: 'svc_backup@innotech.io',
    scopes: ['s3:read', 's3:list'],
    leakSource: '.git/config (committed credentials)',
    endpoints: ['/internal/api/v1/storage/list'],
  }),
  Object.freeze({
    catalogId: 'hr-db-uri',
    tokenType: 'db_uri',
    value: 'mongodb://hr_ro:Rpl1c4_2024@db-replica.internal:27017/hr',
    service: 'hr-read-replica',
    email: 'finance.export@innotech.io',
    scopes: ['db:read'],
    leakSource: 'SQLi credential dump (service_config row)',
    endpoints: [],
  }),
]);

/** All planted honey tokens (frozen). */
function listHoneyTokens() {
  return HONEY_TOKENS;
}

/**
 * Resolve a presented secret to its catalog entry.
 * Matches the primary `value` and any secondary `secret` (e.g. AWS secret key).
 * @returns {object|null}
 */
function findHoneyToken(presented) {
  if (!presented) return null;
  const presentedValue = String(presented).trim();
  if (!presentedValue) return null;
  for (const entry of HONEY_TOKENS) {
    if (entry.value === presentedValue) return entry;
    if (entry.secret && entry.secret === presentedValue) return entry;
  }
  return null;
}

/** Catalog entry by stable id. */
function getHoneyToken(catalogId) {
  return HONEY_TOKENS.find((e) => e.catalogId === catalogId) || null;
}

module.exports = {
  HONEY_TOKENS,
  listHoneyTokens,
  findHoneyToken,
  getHoneyToken,
};
