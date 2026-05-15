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

const TRAP_TYPES    = require('../../logging-data-extraction/constants/trapTypes');
const LoggerService = require('../../logging-data-extraction/services/LoggerService');
const SocketService = require('../../logging-data-extraction/services/SocketService');

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Resolve the attacker IP. Prefer the one Sagiv's gatekeeper attached so we
 * don't disagree with the rest of the pipeline.
 */
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

/**
 * Centralised reporter: every trap calls this on entry (and again on exit
 * for streaming traps so wasted_time_ms / bytes_sent are accurate).
 *
 * @param {string} trapType  one of TRAP_TYPES.*
 * @param {object} req
 * @param {object} [opts]
 * @param {number} [opts.startTime]  Date.now() captured at trap entry
 * @param {number} [opts.bytes_sent]
 * @param {string} [opts.payload]    override the auto-extracted payload
 */
async function report(trapType, req, opts = {}) {
  const payload    = opts.payload  ?? extractPayload(req);
  const attackerIp = getIP(req);

  const eventData = {
    attackerIp,
    trapType,
    payload,
    startTime:      opts.startTime,
    wasted_time_ms: opts.wasted_time_ms,
    bytes_sent:     opts.bytes_sent || 0,
  };

  // Persist to Max's malicious DB + console log
  try { await LoggerService.logAttack(eventData); }
  catch (err) { console.error('[Decoy] logAttack failed:', err.message); }

  // Live broadcast to Yaniv's React dashboard
  try { SocketService.emitLiveAlert({ ...eventData, timestamp: Date.now() }); }
  catch (err) { console.error('[Decoy] emitLiveAlert failed:', err.message); }
}

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
    case TRAP_TYPES.SQLI: return exports.serveFakeDBError(req, res);
    case TRAP_TYPES.XSS:  return exports.renderSandboxXSS(req, res);
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

exports.fakeLogin = async (req, res) => {
  return fakeLoginTrap.handle(req, res, { report });
};

exports.serveHoneyToken = async (req, res) => {
  // Max's enum doesn't include HONEY_TOKEN yet — so we skip the report() call
  // here and only persist the token through honeyToken.generate() which writes
  // directly into the HoneyToken collection.
  const token = await honeyToken.generate(req);
  res.json({ success: true, apiKey: token.apiKey, user: token.user });
};

exports.renderSandboxXSS = async (req, res) => {
  return sandboxXSS.render(req, res, { report });
};

// ─── Dynamic Admin Dashboard (Faker) ─────────────────────────────────────────

exports.renderAdminDashboard = async (req, res) => {
  // No specific signature → treat as generic recon. Use DATA_BOMB type for
  // logging since Max's enum doesn't include UNKNOWN/RECON; this still
  // captures the visit in attack_events for the dashboard.
  await report(TRAP_TYPES.DATA_BOMB, req, { payload: req.originalUrl });

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

  res.render('decoy/admin-dashboard', {
    company:   'InnoTech Corp',
    employees,
    stats,
    generated: new Date().toISOString(),
  });
};
