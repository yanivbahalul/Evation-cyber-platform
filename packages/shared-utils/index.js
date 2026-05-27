const getAttackerIp = require('./getAttackerIp');
const clientIpCore = require('./clientIpCore');

module.exports = {
  getAttackerIp,
  ...clientIpCore,
};
