const getAttackerIp = require('./getAttackerIp');
const clientIpCore = require('./clientIpCore');
const cookiePolicy = require('./cookiePolicy');

module.exports = {
  getAttackerIp,
  ...clientIpCore,
  ...cookiePolicy,
};
