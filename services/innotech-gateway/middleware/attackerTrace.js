'use strict';

const { ensureTraceId } = require('../utils/attackerTrace');

module.exports = (req, res, next) => {
  ensureTraceId(req, res);
  next();
};
