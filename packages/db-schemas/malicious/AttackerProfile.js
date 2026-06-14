const mongoose = require('mongoose');

const AttackerProfileSchema = new mongoose.Schema({
  ip: {
    type: String,
    required: true,
    unique: true,
  },
  city: String,
  country: String,
  countryCode: String,
  lat: Number,
  lng: Number,
  isp: String,                 // ISP / ASN org from geo lookup (Requirements §Attacker Fingerprint)
  geoSource: String,           // e.g. geoip-lite, ip-api.com, lan-egress
  geoPrecision: String,        // city | country | lan | none
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

  // --- ML threat-intel aggregates (services/ml-threat-intel) -------------
  // Highest ML risk score seen across this attacker's events.
  mlRiskScore: { type: Number, min: 0, max: 100 },
  // Worst severity observed: benign < suspicious < malicious.
  mlSeverity: { type: String, enum: ['benign', 'suspicious', 'malicious'] },
  // MITRE ATT&CK tactics observed across the kill chain.
  mlTactics: { type: [String], default: [] },
  // Best threat-actor attribution + its confidence.
  mlThreatActor: String,
  mlThreatActorConfidence: Number,
  // SecBERT style signatures — used to correlate the same actor across IPs.
  mlStyleSignatures: { type: [String], default: [] },
  // Union of model repos that contributed to this profile.
  mlModelsUsed: { type: [String], default: [] },
});

AttackerProfileSchema.index({ mlRiskScore: -1 });
AttackerProfileSchema.index({ mlStyleSignatures: 1 });

AttackerProfileSchema.index({ riskScore: -1 });
AttackerProfileSchema.index({ lastSeen: -1 });

module.exports = AttackerProfileSchema;
