'use strict';

/**
 * Tiered XSS sandbox classifier (deception gateway only).
 * probe  — safe demo payloads (simple alert) may be reflected and executed
 * blocked — serious indicators; show escaped preview only
 */

const BLOCKED_PATTERNS = [
  { re: /document\.cookie/i, reason: 'cookie_access' },
  { re: /\blocalStorage\b/i, reason: 'storage_access' },
  { re: /\bsessionStorage\b/i, reason: 'storage_access' },
  { re: /\bfetch\s*\(/i, reason: 'network_exfil' },
  { re: /\bXMLHttpRequest\b/i, reason: 'network_exfil' },
  { re: /\bnavigator\.sendBeacon\b/i, reason: 'network_exfil' },
  { re: /\bnew\s+Image\s*\(/i, reason: 'beacon_exfil' },
  { re: /\beval\s*\(/i, reason: 'code_execution' },
  { re: /\bFunction\s*\(/i, reason: 'code_execution' },
  { re: /\bsetTimeout\s*\(\s*['"]/i, reason: 'delayed_execution' },
  { re: /\bsetInterval\s*\(\s*['"]/i, reason: 'delayed_execution' },
  { re: /<script[^>]*\bsrc\s*=/i, reason: 'external_script' },
  { re: /\bfromCharCode\b/i, reason: 'encoding_bypass' },
  { re: /\\u00[0-9a-f]{2}/i, reason: 'unicode_bypass' },
  { re: /&#x[0-9a-f]+;/i, reason: 'html_entity_bypass' },
  { re: /\blocation\.(href|replace)\b/i, reason: 'redirect' },
  { re: /\bwindow\.open\s*\(/i, reason: 'popup_redirect' },
  { re: /javascript:\s*[^'"]{40,}/i, reason: 'long_javascript_uri' },
];

const XSS_PROBE_PATTERNS = [
  /<script/i,
  /\bonerror\s*=/i,
  /\bonload\s*=/i,
  /\balert\s*\(/i,
];

const ALERT_ARG_MAX_LEN = 32;

/** Simple alert(…) argument: number or short quoted string, no nested calls. */
const SIMPLE_ALERT_RE = /\balert\s*\(\s*(\d+|'[^']{0,32}'|"[^"]{0,32}")\s*\)/i;

const DEMO_PROBE_EXAMPLES = [
  '<script>alert(1)</script>',
  '<img src=x onerror=alert(1)>',
  "<script>alert('demo')</script>",
];

function hasBlockedIndicator(s) {
  for (const { re, reason } of BLOCKED_PATTERNS) {
    if (re.test(s)) return reason;
  }
  return null;
}

function looksLikeXssProbe(s) {
  return XSS_PROBE_PATTERNS.some((re) => re.test(s));
}

function hasOnlySimpleAlerts(s) {
  const alerts = s.match(/\balert\s*\([^)]*\)/gi);
  if (!alerts || alerts.length === 0) return true;
  return alerts.every((call) => SIMPLE_ALERT_RE.test(call));
}

/**
 * @param {string} raw
 * @returns {{ tier: 'probe'|'blocked', reason?: string, normalized: string }}
 */
function classifyXssPayload(raw) {
  const normalized = String(raw ?? '').trim();

  if (!normalized) {
    return { tier: 'blocked', reason: 'empty_payload', normalized };
  }

  const blockedReason = hasBlockedIndicator(normalized);
  if (blockedReason) {
    return { tier: 'blocked', reason: blockedReason, normalized };
  }

  if (!looksLikeXssProbe(normalized)) {
    return { tier: 'blocked', reason: 'not_probe_pattern', normalized };
  }

  if (!hasOnlySimpleAlerts(normalized)) {
    return { tier: 'blocked', reason: 'complex_alert', normalized };
  }

  return { tier: 'probe', normalized };
}

module.exports = {
  classifyXssPayload,
  DEMO_PROBE_EXAMPLES,
};
