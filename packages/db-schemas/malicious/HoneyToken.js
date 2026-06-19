const mongoose = require('mongoose');

const HoneyTokenSchema = new mongoose.Schema({
  // Stable id from the shared honey-token catalog (used to upsert/seed).
  catalogId: {
    type: String,
    index: true,
  },
  fakeUsername: {
    type: String,
    required: true,
  },
  fakePassword: {
    type: String,
    required: true,
  },
  // Provenance — what kind of credential, which service it belongs to, the
  // scopes it grants, and where it was planted so it would "leak".
  tokenType: {
    type: String,
    enum: ['api_key', 'aws_key', 'db_uri', 'jwt'],
    default: 'api_key',
  },
  service: {
    type: String,
  },
  scopes: {
    type: [String],
    default: [],
  },
  leakSource: {
    type: String,
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
      method: String,
      path: String,
      userAgent: String,
      // HTTP status the decoy API returned for this use (200/401/403/429).
      outcome: Number,
      traceId: String,
    },
  ],
});

module.exports = HoneyTokenSchema;
