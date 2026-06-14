const mongoose = require('mongoose');

/**
 * ML threat-intel enrichment produced by services/ml-threat-intel and attached
 * to attack_events by the telemetry service. All fields are optional — events
 * written before enrichment (or when the ML service is down) simply omit it.
 *
 * Kept as `_id: false` so it embeds inline without its own ObjectId.
 */
const MlTechniqueSchema = new mongoose.Schema(
  {
    id: String,
    name: String,
    tactic: String,
    score: Number,
  },
  { _id: false }
);

const MlActorCandidateSchema = new mongoose.Schema(
  { group: String, score: Number },
  { _id: false }
);

const MlEnrichmentSchema = new mongoose.Schema(
  {
    riskScore: { type: Number, min: 0, max: 100 },
    severity: { type: String, enum: ['benign', 'suspicious', 'malicious'] },
    engine: { type: String, enum: ['ml', 'heuristic', 'hybrid'] },
    payload: {
      label: String, // malicious | benign
      attackType: String,
      confidence: Number,
      model: String,
    },
    log: {
      label: String,
      confidence: Number,
      model: String,
    },
    mitre: {
      tactic: String,
      tacticConfidence: Number,
      techniques: { type: [MlTechniqueSchema], default: undefined },
      model: String,
    },
    threatActor: {
      group: String,
      confidence: Number,
      candidates: { type: [MlActorCandidateSchema], default: undefined },
      model: String,
    },
    styleSignature: String,
    modelsUsed: { type: [String], default: undefined },
    computedAt: Date,
  },
  { _id: false }
);

module.exports = MlEnrichmentSchema;
