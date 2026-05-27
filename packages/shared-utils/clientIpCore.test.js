'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { resolveAttackerIp } = require('./clientIpCore');

function mockReq(overrides = {}) {
  const headers = overrides.headers || {};
  return {
    headers: {
      get(name) {
        const key = name.toLowerCase();
        const v = headers[key] ?? headers[name];
        return v == null ? null : String(v);
      },
      ...headers,
    },
    socket: { remoteAddress: overrides.remoteAddress ?? '127.0.0.1' },
    ip: overrides.ip,
    ...overrides,
  };
}

describe('resolveAttackerIp', () => {
  it('returns LAN IP from x-client-ip behind local proxy', () => {
    const req = mockReq({
      headers: { 'x-client-ip': '192.168.0.65' },
      remoteAddress: '127.0.0.1',
    });
    assert.equal(resolveAttackerIp(req), '192.168.0.65');
  });

  it('returns 127.0.0.1 for localhost dev (stamped x-client-ip)', () => {
    const req = mockReq({
      headers: { 'x-client-ip': '127.0.0.1' },
      remoteAddress: '127.0.0.1',
    });
    assert.equal(resolveAttackerIp(req), '127.0.0.1');
  });

  it('returns 127.0.0.1 when only local proxy hop and no stamped header', () => {
    const req = mockReq({ headers: {}, remoteAddress: '127.0.0.1' });
    assert.equal(resolveAttackerIp(req), '127.0.0.1');
  });

  it('returns unknown when peer is not local and no client IP headers', () => {
    const req = mockReq({ headers: {}, remoteAddress: '203.0.113.50' });
    assert.equal(resolveAttackerIp(req), '203.0.113.50');
  });

  it('prefers x-forwarded-for client on trusted proxy', () => {
    const req = mockReq({
      headers: { 'x-forwarded-for': '198.51.100.22, 10.0.0.1' },
      remoteAddress: '10.0.0.1',
    });
    process.env.TRUSTED_PROXY_IPS = '10.0.0.1';
    try {
      assert.equal(resolveAttackerIp(req), '198.51.100.22');
    } finally {
      delete process.env.TRUSTED_PROXY_IPS;
    }
  });

  it('returns unknown with no IP signal', () => {
    const req = mockReq({ headers: {}, remoteAddress: '', ip: undefined });
    req.socket = { remoteAddress: undefined };
    assert.equal(resolveAttackerIp(req), 'unknown');
  });
});
