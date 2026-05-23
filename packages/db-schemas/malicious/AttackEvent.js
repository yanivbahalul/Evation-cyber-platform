const mongoose = require('mongoose');
const { randomUUID } = require('crypto');
const TRAP_TYPES = require('@evation/shared-constants');

const AttackEventSchema = new mongoose.Schema(
  {
    eventID: {
      type: String,
      default: () => randomUUID(),
      unique: true,
      index: true,
    },
    attackerIp: {
      type: String,
      required: true,
      index: true,
    },
    traceId: {
      type: String,
      index: true,
    },
    trapType: {
      type: String,
      enum: Object.values(TRAP_TYPES),
      required: true,
    },
    payload: {
      type: String,
    },
    wasted_time_ms: {
      type: Number,
      default: 0,
    },
    bytes_sent: {
      type: Number,
      default: 0,
    },
    method: String,
    path: String,
    userAgent: String,
    referer: String,
    fingerprint: {
      os: String,
      platform: String,
      browser: String,
      browserVersion: String,
      deviceType: String,
      isBot: Boolean,
      riskScore: Number,
    },
    handoffFrom: String,
    xssTier: String,
    secondaryTraps: [String],
    timestamp: {
      type: Date,
      default: Date.now,
    },
  },
  {
    collection: 'attack_events',
  }
);

module.exports = AttackEventSchema;
