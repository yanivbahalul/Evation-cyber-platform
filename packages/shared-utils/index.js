const getAttackerIp = require('./getAttackerIp');
const clientIpCore = require('./clientIpCore');
const cookiePolicy = require('./cookiePolicy');
const attackLog = require('./attackLog');
const fingerprint = require('./fingerprint');

module.exports = {
  getAttackerIp,
  attackLog,
  fingerprint,
  ...clientIpCore,
  ...cookiePolicy,
};
