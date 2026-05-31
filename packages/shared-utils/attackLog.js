'use strict';

const TRAP_LABELS = {
  SQLI: 'SQL injection tarpit',
  XSS: 'XSS sandbox',
  DATA_BOMB: 'data bomb download',
  BRUTE_FORCE: 'fake login brute force',
  HONEY_TOKEN: 'honey token',
  RECON: 'fake admin recon',
  PATH_TRAVERSAL: 'path traversal file viewer',
  SSRF: 'SSRF metadata lure',
  SCANNER: 'scanner tarpit',
};

function truncate(value, max = 100) {
  const s = value == null ? '' : String(value);
  return s.length > max ? `${s.slice(0, max)}...` : s;
}

function formatFields(fields) {
  return Object.entries(fields)
    .filter(([, v]) => v !== undefined && v !== null && String(v) !== '')
    .map(([k, v]) => {
      const text = typeof v === 'object' ? JSON.stringify(v) : String(v);
      return `${k}=${text.includes(' ') ? JSON.stringify(text) : text}`;
    })
    .join(' ');
}

function line(service, message, fields = {}) {
  const extra = formatFields(fields);
  return extra ? `[${service}] ${message} | ${extra}` : `[${service}] ${message}`;
}

function trapLabel(trapType) {
  return TRAP_LABELS[trapType] || trapType || 'unknown';
}

function requestFields(req) {
  if (!req) return {};
  return {
    ip: req.threatInfo?.originIP || req.ip,
    method: req.method,
    path: truncate(req.originalUrl || req.url, 120),
  };
}

module.exports = {
  trapLabel,
  truncate,
  requestFields,
  info(service, message, fields) {
    console.log(line(service, message, fields));
  },
  warn(service, message, fields) {
    console.warn(line(service, message, fields));
  },
  error(service, message, fields) {
    console.error(line(service, message, fields));
  },
};
