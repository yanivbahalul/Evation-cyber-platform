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
  archiveExport: '/internal/exports/archive',
  fileViewer: '/internal/services/files',
  fetchStatus: '/internal/services/fetch-status',
  signOut: '/internal/auth/signout',
});

const ALIASES = Object.freeze({
  console: '/decoy-portal',
  legacySignIn: '/decoy-portal/login',
  database: '/decoy-portal/sqli',
  apiKeys: '/decoy-portal/honey-token',
  archiveExport: '/decoy-portal/data-bomb',
});

function normalizePath(path = '') {
  const p = String(path);
  return p.length > 1 && p.endsWith('/') ? p.slice(0, -1) : p;
}

function isDatabaseTrapPath(path) {
  const p = normalizePath(path);
  return p === PATHS.database || p === ALIASES.database;
}

function isLegacySignInPath(path) {
  const p = normalizePath(path);
  return (
    p === PATHS.legacySignIn ||
    p === ALIASES.legacySignIn ||
    p.endsWith('/auth/legacy')
  );
}

/** Employee HR login (not legacy admin sign-in). Works with `/login` and `/gateway/login`. */
function isEmployeeLoginPath(path) {
  const p = normalizePath(path);
  if (isLegacySignInPath(p)) return false;
  return p === '/login' || p.endsWith('/login');
}

function isFileViewerPath(path) {
  const p = normalizePath(path);
  return p === PATHS.fileViewer;
}

function isFetchStatusPath(path) {
  const p = normalizePath(path);
  return p === PATHS.fetchStatus;
}

function isInternalZonePath(path) {
  const p = normalizePath(path);
  return (
    Object.values(PATHS).includes(p) ||
    Object.values(ALIASES).includes(p) ||
    p.startsWith('/internal/')
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
  isInternalZonePath,
};
