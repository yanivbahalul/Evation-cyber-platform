'use strict';

/**
 * decoyController.js (BAR — Deception Engine)
 *
 * Receives every malicious request that Sagiv's gatekeeper reroutes via
 *   req.threatInfo = { type, originIP };
 *   req.url        = '/decoy-portal';
 *
 * Dispatches to the appropriate trap based on threatInfo.type and reports
 * every fired trap to Max's telemetry pipeline (LoggerService.logAttack +
 * SocketService.emitLiveAlert).
 */

const { faker } = require('@faker-js/faker');

const dataBomb      = require('../traps/dataBomb');
const tarpit        = require('../traps/tarpit');
const fakeLoginTrap = require('../traps/fakeLogin');
const honeyToken    = require('../traps/honeyToken');
const sandboxXSS    = require('../traps/sandboxXSS');

const TRAP_TYPES    = require('@evation/shared-constants');
const { getAttackerIp } = require('@evation/shared-utils');
const LoggerService = require('../../logging-data-extraction/services/LoggerService');
const { emitLiveAlert } = require('../utils/telemetryLiveAlert');
const attackLog     = require('../utils/attackLog');
const legacyBreachSession = require('../utils/legacyBreachSession');
const sqliDumpRotation = require('../utils/sqliDumpRotation');
const { PATHS: DP } = require('../config/deceptionPaths');
function usernameFromSqliPayload(req) {
  const raw = String(req.body?.username || req.query?.username || '').trim();
  const m = raw.match(/^([a-zA-Z0-9._-]+)/);
  return (m && m[1]) || 'admin';
}

function buildFakeCredentialRows() {
  const rows = [
    { id: 1, username: 'admin', password: 'InnoTech!2024', hash: '$2y$10$7eL8fakeadminhashplaceholder', role: 'administrator' },
    { id: 2, username: 'hr_svc', password: 'svc_HR_9k2m', hash: '$2y$10$9fakehrhashvalue000000000', role: 'service' },
    { id: 3, username: 'j.doe', password: 'Welcome123!', hash: '$2y$10$3fakedoehash00000000000000', role: 'employee' },
  ];
  for (let i = 0; i < 7; i++) {
    const u = faker.internet.username().toLowerCase().replace(/[^a-z0-9._-]/g, '');
    rows.push({
      id: rows.length + 1,
      username: u,
      password: faker.internet.password({ length: 12 }),
      hash: `$2y$10$${faker.string.alphanumeric(22)}`,
      role: faker.helpers.arrayElement(['employee', 'manager', 'readonly']),
    });
  }
  return rows;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Stringify the relevant parts of the request so Max can store the raw
 * malicious string in AttackEvent.payload.
 */
function extractPayload(req) {
  const candidate =
    req.body?.payload ??
    req.query?.payload ??
    req.body ??
    req.query ??
    {};
  try {
    return typeof candidate === 'string' ? candidate : JSON.stringify(candidate);
  } catch {
    return String(candidate);
  }
}

function buildEventFields(req, opts = {}) {
  return {
    traceId: req.traceId,
    method: req.method,
    path: req.originalUrl || req.path,
    userAgent: req.headers['user-agent'],
    referer: req.headers['referer'] || req.headers['referrer'],
    fingerprint: req.attackerFingerprint || {},
    handoffFrom: opts.handoffFrom,
    xssTier: opts.xssTier,
    secondaryTraps: opts.secondaryTraps ?? req.threatInfo?.secondary ?? [],
  };
}

/**
 * Centralised reporter: every trap calls this on entry (and again on exit
 * for streaming traps so wasted_time_ms / bytes_sent are accurate).
 */
async function report(trapType, req, opts = {}) {
  const payload    = opts.payload  ?? extractPayload(req);
  const attackerIp = getAttackerIp(req);

  const eventData = {
    attackerIp,
    trapType,
    payload,
    startTime:      opts.startTime,
    wasted_time_ms: opts.wasted_time_ms,
    bytes_sent:     opts.bytes_sent || 0,
    ...buildEventFields(req, opts),
  };

  try {
    await LoggerService.logAttack(eventData);
  } catch (err) {
    attackLog.error('TRAP', 'save_to_database_failed', { trap: trapType, ip: attackerIp, error: err.message });
  }

  const alertResult = await emitLiveAlert({ ...eventData, timestamp: Date.now() });
  if (alertResult.status === 'sent') {
    attackLog.info('TRAP', 'live_alert_sent_to_admin', {
      trap: trapType,
      trap_label: attackLog.trapLabel(trapType),
      ip: attackerIp,
      trace_id: req.traceId,
      telemetry_url: process.env.NEXT_PUBLIC_TELEMETRY_SOCKET_URL || 'http://localhost:3002',
    });
  } else if (alertResult.status === 'skipped') {
    attackLog.warn('TRAP', 'live_alert_skipped', {
      trap: trapType,
      ip: attackerIp,
      reason: alertResult.reason,
    });
  } else {
    attackLog.error('TRAP', 'live_alert_failed', {
      trap: trapType,
      ip: attackerIp,
      error: alertResult.reason || 'unknown',
    });
  }
}

exports.report = report;

// ─── Public Dispatch ─────────────────────────────────────────────────────────

/**
 * Entry point wired to /decoy-portal (see INTEGRATION_NOTES.md).
 * Routes the request to the right trap based on req.threatInfo.type.
 *
 *   'SQLI' → Tarpit
 *   'XSS'  → Sandbox XSS
 *   else   → fake admin dashboard (keeps recon traffic busy)
 *
 * BRUTE_FORCE / DATA_BOMB traps are triggered by their own dedicated
 * routes, not via this dispatcher.
 */
exports.dispatch = async (req, res) => {
  const threat = req.threatInfo?.type;

  switch (threat) {
    case TRAP_TYPES.SQLI: return exports.handleDatabaseExport(req, res);
    case TRAP_TYPES.XSS:  return exports.renderSandboxXSS(req, res);
    case TRAP_TYPES.PATH_TRAVERSAL: return exports.renderFileViewer(req, res);
    case TRAP_TYPES.SSRF: return exports.renderFetchStatus(req, res);
    case TRAP_TYPES.SCANNER: return exports.serveScannerTarpit(req, res);
    case TRAP_TYPES.RECON:
    case TRAP_TYPES.HONEY_TOKEN:
      return exports.renderAdminDashboard(req, res);
    default:              return exports.renderAdminDashboard(req, res);
  }
};

// ─── Individual Trap Handlers ────────────────────────────────────────────────

exports.serveDataBomb = async (req, res) => {
  // dataBomb reports its own bytes_sent / wasted_time_ms when the stream ends
  return dataBomb.stream(req, res, { report });
};

exports.serveFakeDBError = async (req, res) => {
  return tarpit.hold(req, res, { report });
};

exports.renderDatabaseConsole = async (req, res) => {
  const legacyUser = legacyBreachSession.readBreachUser(req);
  res.render('decoy/database-console', {
    legacyUser,
    query: req.query?.q || 'SELECT * FROM users',
    lastError: req.query?.err ? String(req.query.err) : '',
    withBase: req.withBase || ((p) => p),
    dp: DP,
  });
};

exports.handleDatabaseExport = async (req, res) => {
  const startTime = Date.now();
  const legacyUser = legacyBreachSession.readBreachUser(req);
  const wantsDump =
    req.query?.export === 'credentials' ||
    req.method === 'POST' ||
    (req.body?.query && /select|from|users/i.test(String(req.body.query)));

  if (!wantsDump) {
    return exports.renderDatabaseConsole(req, res);
  }

  if (sqliDumpRotation.shouldShowCredentialDump(req)) {
    const rows = buildFakeCredentialRows();
    await report(TRAP_TYPES.SQLI, req, {
      startTime,
      wasted_time_ms: Date.now() - startTime,
      bytes_sent: rows.length * 80,
      payload: JSON.stringify({ action: 'credential_dump', rows: rows.length }),
    });
    return res.render('decoy/credential-dump', {
      legacyUser,
      rows,
      rowCount: rows.length,
      withBase: req.withBase || ((p) => p),
      dp: DP,
    });
  }

  return tarpit.hold(req, res, { report });
};

/** SQLi on employee login → fake “bypass succeeded” legacy page. */
exports.handoffSqliBypassLogin = async (req, res) => {
  const name = legacyBreachSession.establishBreachSession(res, { username: usernameFromSqliPayload(req) });
  attackLog.warn('GATEWAY', 'sqli_bypass_illusion', {
    trap: TRAP_TYPES.SQLI,
    username: name,
    ...attackLog.requestFields(req),
  });
  await report(TRAP_TYPES.SQLI, req, {
    payload: JSON.stringify({ handoff: 'sqli_bypass_illusion', username: name }),
    handoffFrom: 'employee_login',
    wasted_time_ms: 0,
  });
  return res.redirect(302, req.withBase(`${DP.legacySignIn}?sqli=bypass&next=db`));
};

exports.fakeLogin = async (req, res) => {
  return fakeLoginTrap.handle(req, res, { report });
};

exports.logoutLegacyAdmin = (req, res) => {
  legacyBreachSession.clearBreachSession(res);
  attackLog.info('GATEWAY', 'legacy_admin_signout', { ...attackLog.requestFields(req) });
  return res.redirect(302, req.withBase('/login'));
};

exports.renderFakeLoginPage = (req, res) => {
  const fromBrute = req.query?.from === 'brute';
  if (fromBrute) {
    legacyBreachSession.establishBreachSession(res, { username: req.query?.username || 'administrator' });
    return res.redirect(302, req.withBase(`${DP.console}?breach=legacy`));
  }

  const sqliBypass = req.query?.sqli === 'bypass';
  const showDbHint = req.query?.next === 'db';
  const legacyUser = legacyBreachSession.readBreachUser(req);

  res.render('decoy/fake-login', {
    error: req.query?.error || '',
    username: legacyUser?.username || req.query?.username || '',
    withBase: req.withBase || ((p) => p),
    legacy: false,
    sqliBypass,
    showDbHint,
    legacyUser: sqliBypass ? legacyUser : null,
    dp: DP,
  });
};

exports.serveHoneyToken = async (req, res) => {
  const token = await honeyToken.generate(req);
  await report(TRAP_TYPES.HONEY_TOKEN, req, {
    payload: JSON.stringify({ apiKey: token.apiKey?.slice(0, 12) + '…' }),
  });
  if (req.accepts('html')) {
    return res.render('decoy/honey-token', {
      apiKey: token.apiKey,
      user: token.user,
      legacyUser: legacyBreachSession.readBreachUser(req),
      withBase: req.withBase || ((p) => p),
    });
  }
  res.json({ success: true, apiKey: token.apiKey, user: token.user });
};

exports.renderSandboxXSS = async (req, res) => {
  return sandboxXSS.render(req, res, { report });
};

// ─── Dynamic Admin Dashboard (Faker) ─────────────────────────────────────────

exports.renderFileViewer = async (req, res) => {
  const requested = String(req.query?.file || req.query?.path || '../../../etc/passwd');
  await report(TRAP_TYPES.PATH_TRAVERSAL, req, {
    payload: JSON.stringify({ file: requested }),
    wasted_time_ms: 0,
  });
  const legacyUser = legacyBreachSession.readBreachUser(req);
  res.render('decoy/file-viewer', {
    requested,
    legacyUser,
    withBase: req.withBase || ((p) => p),
    dp: DP,
  });
};

exports.renderFetchStatus = async (req, res) => {
  const target = String(req.query?.url || req.body?.url || 'http://169.254.169.254/latest/meta-data/');
  await report(TRAP_TYPES.SSRF, req, {
    payload: JSON.stringify({ url: target }),
    wasted_time_ms: 0,
  });
  if (req.accepts('json') && !req.accepts('html')) {
    return res.json({
      success: true,
      fetched: target,
      instanceId: 'i-0f4e8b2c9a1d3e5f7',
      region: 'us-east-1',
      iam: { role: 'InnoTech-HR-Prod-Role', credentials: '***REDACTED***' },
      note: 'Internal metadata bridge — legacy integration',
    });
  }
  const legacyUser = legacyBreachSession.readBreachUser(req);
  return res.render('decoy/fetch-status', {
    target,
    legacyUser,
    withBase: req.withBase || ((p) => p),
    dp: DP,
  });
};

exports.serveScannerTarpit = async (req, res) => {
  return tarpit.hold(req, res, {
    trapType: TRAP_TYPES.SCANNER,
    report: (t, r, opts) =>
      report(t, r, {
        ...opts,
        payload: JSON.stringify({ scanner_ua: r.headers['user-agent'] }),
      }),
  });
};

exports.renderAdminDashboard = async (req, res) => {
  const skipReport =
    req.threatInfo?.type === TRAP_TYPES.HONEY_TOKEN ||
    req.query?.breach === 'legacy' ||
    req.query?.token_ack === '1';

  if (!skipReport) {
    const trapType = req.threatInfo?.type === TRAP_TYPES.HONEY_TOKEN
      ? TRAP_TYPES.HONEY_TOKEN
      : TRAP_TYPES.RECON;
    await report(trapType, req, { payload: req.originalUrl || req.path });
  }

  // Fresh fake company on every request — defeats automated scrapers
  const employees = Array.from({ length: 12 }, () => ({
    id:         faker.string.uuid(),
    name:       faker.person.fullName(),
    email:      faker.internet.email({ provider: 'innotech.io' }),
    department: faker.commerce.department(),
    salary:     faker.number.int({ min: 55000, max: 180000 }),
    joined:     faker.date.past({ years: 5 }).toLocaleDateString(),
    role:       faker.person.jobTitle(),
  }));

  const stats = {
    totalEmployees: faker.number.int({ min: 200, max: 800 }),
    revenue:        `$${faker.number.int({ min: 1, max: 50 })}M`,
    openTickets:    faker.number.int({ min: 5, max: 120 }),
    uptime:         `${faker.number.float({ min: 98.5, max: 99.99, fractionDigits: 2 })}%`,
  };

  const breachUser = legacyBreachSession.readBreachUser(req);
  const breachFlash = req.query?.breach === 'legacy' || !!breachUser;
  const tokenAck = req.query?.token_ack === '1';

  res.render('decoy/admin-dashboard', {
    company:   'InnoTech Corp',
    employees,
    stats,
    generated: new Date().toISOString(),
    withBase:  req.withBase || ((p) => p),
    user: breachUser,
    breachFlash,
    breachUsername: breachUser?.username || 'administrator',
    tokenAck,
    dp: DP,
  });
};
