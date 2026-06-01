'use strict';

const GLOBAL_URLS_KEY = '__evation_stack_urls_printed__';

function publicHost() {
  return (process.env.PUBLIC_HOST || process.env.DEV_PUBLIC_HOST || 'localhost').trim();
}

function publicPort() {
  return (process.env.PUBLIC_PORT || process.env.UI_PORT || '3000').trim();
}

function entryUrl(path = '/') {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `http://${publicHost()}:${publicPort()}${normalized}`;
}

function isVerbose() {
  const v = process.env.LOG_VERBOSE;
  return v === '1' || v === 'true';
}

/** One-line service readiness (no URLs). */
function logServiceReady(service) {
  console.log(`[EVATION] ${service} ready`);
}

/** User-facing entry URL via nginx (:3000 on host). Printed once per process tree. */
function logStackUrls() {
  if (globalThis[GLOBAL_URLS_KEY]) return;
  globalThis[GLOBAL_URLS_KEY] = true;
  console.log(`[EVATION] open in browser: ${entryUrl('/')}`);
}

function logPublicTunnel(url) {
  console.log(`[EVATION] public tunnel: ${url}`);
}

module.exports = {
  isVerbose,
  logServiceReady,
  logStackUrls,
  logPublicTunnel,
  entryUrl,
};
