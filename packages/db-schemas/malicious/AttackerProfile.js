const mongoose = require('mongoose');

const AttackerProfileSchema = new mongoose.Schema({
  ip: {
    type: String,
    required: true,
    unique: true,
  },
  city: String,
  lat: Number,
  lng: Number,
  isp: String,                 // ISP / ASN org from geo lookup (Requirements §Attacker Fingerprint)
  os: String,
  platform: String,
  browser: String,
  deviceType: String,
  screenResolution: String,    // e.g. "1920x1080" — populated via client-side beacon
  isBot: { type: Boolean, default: false },
  riskScore: {
    type: Number,
    default: 0,
  },
  firstSeen: {
    type: Date,
    default: Date.now,
  },
  lastSeen: {
    type: Date,
    default: Date.now,
  },
  traceIds: {
    type: [String],
    default: [],
  },
  banned: { type: Boolean, default: false, index: true },
  bannedAt: Date,
  bannedBy: String,
});

module.exports = AttackerProfileSchema;
