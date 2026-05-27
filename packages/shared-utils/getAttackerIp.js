'use strict';

const { resolveAttackerIp } = require('./clientIpCore');

/** @param {import('http').IncomingMessage} req */
const getAttackerIp = (req) => resolveAttackerIp(req);

module.exports = getAttackerIp;
