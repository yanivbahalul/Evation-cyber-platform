'use strict';

const { getAttackerIp } = require('@evation/shared-utils');
const HrTicket = require('../models/HrTicket');

const VALID_SOURCES = new Set(['profile_edit', 'contact', 'dashboard']);

const SUSPICIOUS_PATTERNS = [
  { re: /password\s*(reset|change|reveal)/i, reason: 'credential_request' },
  { re: /\b(wire|bank)\s*transfer\b/i, reason: 'financial_fraud' },
  { re: /\b(gift\s*card|bitcoin|crypto)\b/i, reason: 'payment_fraud' },
  { re: /\b(ceo|executive|urgent).{0,40}(approve|transfer|wire)\b/i, reason: 'bec_language' },
  { re: /\b(api|ssh|vpn)\s*key\b/i, reason: 'secret_request' },
  { re: /\b(bypass|disable).{0,20}(2fa|mfa|auth)\b/i, reason: 'auth_bypass' },
  { re: /\b(admin|root|sudo)\s*access\b/i, reason: 'privilege_escalation' },
  { re: /\b(ssn|social\s*security|bank\s*account)\b/i, reason: 'pii_harvest' },
  { re: /<script|javascript:|onerror=/i, reason: 'xss_marker' },
  { re: /(?:'|")\s*(?:OR|AND)\s+/i, reason: 'sqli_marker' },
];

function normalizeSource(source) {
  const s = String(source || 'contact').trim();
  return VALID_SOURCES.has(s) ? s : 'contact';
}

function generateTicketId() {
  const suffix = Date.now().toString(36).toUpperCase().slice(-6);
  const rand = Math.random().toString(36).toUpperCase().slice(2, 5);
  return `IT-${suffix}${rand}`;
}

function analyzeTicket({ subject, message, source, authenticated }) {
  const text = `${subject} ${message}`;
  const reasons = [];

  for (const { re, reason } of SUSPICIOUS_PATTERNS) {
    if (re.test(text) && !reasons.includes(reason)) reasons.push(reason);
  }

  if (source === 'profile_edit' && !authenticated) {
    reasons.push('unauthenticated_profile_edit');
  }

  if (message.length > 0 && message.length < 8 && /test|asdf|xxx/i.test(message)) {
    reasons.push('low_effort_probe');
  }

  return {
    isSuspicious: reasons.length > 0,
    suspiciousReasons: reasons,
  };
}

async function createTicket(req, { subject, message, source }) {
  const normalizedSource = normalizeSource(source);
  const authenticated = Boolean(req.user?.username);
  const analysis = analyzeTicket({
    subject,
    message,
    source: normalizedSource,
    authenticated,
  });

  const doc = await HrTicket.create({
    ticketId: generateTicketId(),
    subject,
    message,
    source: normalizedSource,
    status: 'open',
    isSuspicious: analysis.isSuspicious,
    suspiciousReasons: analysis.suspiciousReasons,
    submittedBy: req.user?.username || null,
    submitterIp: getAttackerIp(req),
    submitterUserAgent: String(req.headers['user-agent'] || '').slice(0, 500),
    traceId: req.traceId || null,
  });

  return doc.toObject();
}

async function listTickets({ limit = 200, suspiciousOnly = false, status } = {}) {
  const filter = {};
  if (suspiciousOnly) filter.isSuspicious = true;
  if (status && ['open', 'in_review', 'closed'].includes(status)) filter.status = status;
  const rows = await HrTicket.find(filter)
    .sort({ createdAt: -1 })
    .limit(Math.min(limit, 500))
    .lean();
  return rows;
}

async function updateTicketStatus(ticketId, status) {
  const normalized = String(ticketId || '').trim();
  if (!normalized) return null;
  if (!['open', 'in_review', 'closed'].includes(status)) return null;
  return HrTicket.findOneAndUpdate(
    { ticketId: normalized },
    { $set: { status } },
    { new: true }
  ).lean();
}

module.exports = {
  createTicket,
  listTickets,
  updateTicketStatus,
  analyzeTicket,
  normalizeSource,
};
