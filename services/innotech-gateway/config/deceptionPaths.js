'use strict';

/**
 * Public URL paths for deception endpoints — must look like real internal IT routes.
 * Legacy /decoy-portal/* aliases remain wired for old bookmarks/scanners but are never linked in UI.
 */
const PATHS = Object.freeze({
  console: '/internal/console',
  legacySignIn: '/internal/auth/legacy',
  database: '/internal/services/database',
  apiKeys: '/internal/integrations/keys',
  hrExport: '/internal/api/v1/hr/export',
  storageList: '/internal/api/v1/storage/list',
  archiveExport: '/internal/exports/archive',
  fileViewer: '/internal/services/files',
  fetchStatus: '/internal/services/fetch-status',
  signOut: '/internal/auth/signout',
  // Planted "leaked" artifacts that carry the honey-token catalog values.
  envLeak: '/.env',
  envLeakInternal: '/internal/.env',
  gitConfigLeak: '/.git/config',
});

const ALIASES = Object.freeze({
  console: '/decoy-portal',
  legacySignIn: '/decoy-portal/login',
  database: '/decoy-portal/sqli',
  apiKeys: '/decoy-portal/honey-token',
  archiveExport: '/decoy-portal/data-bomb',
});

function normalizePath(path = '') {
  const normalized = String(path);
  return normalized.length > 1 && normalized.endsWith('/') ? normalized.slice(0, -1) : normalized;
}

function isDatabaseTrapPath(path) {
  const normalized = normalizePath(path);
  return normalized === PATHS.database || normalized === ALIASES.database;
}

function isLegacySignInPath(path) {
  const normalized = normalizePath(path);
  return (
    normalized === PATHS.legacySignIn ||
    normalized === ALIASES.legacySignIn ||
    normalized.endsWith('/auth/legacy')
  );
}

/** Employee HR login (not legacy admin sign-in). Works with `/login` and `/gateway/login`. */
function isEmployeeLoginPath(path) {
  const normalized = normalizePath(path);
  if (isLegacySignInPath(normalized)) return false;
  return normalized === '/login' || normalized.endsWith('/login');
}

function isFileViewerPath(path) {
  const normalized = normalizePath(path);
  return normalized === PATHS.fileViewer;
}

function isFetchStatusPath(path) {
  const normalized = normalizePath(path);
  return normalized === PATHS.fetchStatus;
}

function isHoneyTokenApiExportPath(path) {
  const normalized = normalizePath(path);
  return normalized === PATHS.hrExport;
}

function isStorageListPath(path) {
  const normalized = normalizePath(path);
  return normalized === PATHS.storageList;
}

/** Any decoy API endpoint that a stolen honey token is "meant" to call. */
function isHoneyApiPath(path) {
  return isHoneyTokenApiExportPath(path) || isStorageListPath(path);
}

/** Planted leaked artifacts (served as raw text to look like exposed files). */
function isLeakedArtifactPath(path) {
  const normalized = normalizePath(path);
  return normalized === PATHS.envLeak || normalized === PATHS.envLeakInternal || normalized === PATHS.gitConfigLeak;
}

function isConsolePath(path) {
  const normalized = normalizePath(path);
  return normalized === PATHS.console || normalized === ALIASES.console;
}

function isInternalZonePath(path) {
  const normalized = normalizePath(path);
  return (
    Object.values(PATHS).includes(normalized) ||
    Object.values(ALIASES).includes(normalized) ||
    normalized.startsWith('/internal/')
  );
}

module.exports = {
  PATHS,
  ALIASES,
  normalizePath,
  isDatabaseTrapPath,
  isLegacySignInPath,
  isEmployeeLoginPath,
  isFileViewerPath,
  isFetchStatusPath,
  isHoneyTokenApiExportPath,
  isStorageListPath,
  isHoneyApiPath,
  isLeakedArtifactPath,
  isConsolePath,
  isInternalZonePath,
};
