const mongoose = require('mongoose');

const HoneyTokenSchema = new mongoose.Schema({
  fakeUsername: {
    type: String,
    required: true,
  },
  fakePassword: {
    type: String,
    required: true,
  },
  isTriggered: {
    type: Boolean,
    default: false,
  },
  triggeredLogs: [
    {
      attackerIp: String,
      timestamp: { type: Date, default: Date.now },
      networkContext: String,
    },
  ],
});

module.exports = HoneyTokenSchema;
