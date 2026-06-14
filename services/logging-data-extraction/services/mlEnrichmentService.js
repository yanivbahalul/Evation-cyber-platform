'use strict';

/**
 * Best-effort bridge to the ML threat-intel service (services/ml-threat-intel).
 *
 * After an AttackEvent is persisted, the telemetry service calls /enrich and
 * writes the result back onto the event and the attacker profile. Everything
 * here is non-authoritative: if the ML service is disabled, slow, or down, the
 * core write pipeline is unaffected and we simply skip enrichment.
 */

const connectMaliciousDB = require('../config/maliciousDb');
const { attackLog } = require('@evation/shared-utils');

const ENABLED = process.env.ML_ENRICHMENT_ENABLED !== 'false';
const ML_SERVICE_URL = (process.env.ML_SERVICE_URL || 'http://localhost:3003').replace(/\/$/, '');
const TIMEOUT_MS = Number(process.env.ML_ENRICHMENT_TIMEOUT_MS || 8000);

const SEVERITY_RANK = { benign: 0, suspicious: 1, malicious: 2 };

/** Pull the recent trap-type sequence for this attacker (oldest → newest). */
async function recentTrapSequence(attackerIp, traceId) { // skipcq: JS-0067
  try {
    const conn = connectMaliciousDB();
    if (!conn?.models?.AttackEvent) return [];
    const filter = { attackerIp };
    if (traceId) filter.traceId = traceId;
    const rows = await conn
      .model('AttackEvent')
      .find(filter)
      .sort({ timestamp: 1 })
      .limit(15)
      .select('trapType')
      .lean();
    return rows.map((r) => String(r.trapType)).filter(Boolean);
  } catch {
    return [];
  }
}

/** Call POST /enrich on the ML service. Returns the enrichment object or null. */
async function callEnrich(payload) { // skipcq: JS-0067
  const token = process.env.ADMIN_SOCKET_TOKEN;
  const res = await fetch(`${ML_SERVICE_URL}/enrich`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) {
    throw new Error(`ml_service_status_${res.status}`);
  }
  return res.json();
}

/** Persist enrichment onto the AttackEvent and roll it up into the profile. */
async function persistEnrichment(eventID, attackerIp, enrichment) { // skipcq: JS-0067, JS-R1005
  const conn = connectMaliciousDB();
  if (!conn?.models?.AttackEvent) return;

  await conn
    .model('AttackEvent')
    .updateOne({ eventID }, { $set: { mlEnrichment: enrichment } });

  if (!conn.models.AttackerProfile) return;
  const AttackerProfile = conn.model('AttackerProfile');
  const existing = await AttackerProfile.findOne({ ip: attackerIp })
    .select('mlRiskScore mlSeverity')
    .lean();

  const $set = {};
  const $max = {};
  const $addToSet = {};

  if (Number.isFinite(enrichment.riskScore)) {
    $max.mlRiskScore = enrichment.riskScore;
  }
  if (enrichment.severity) {
    const prevRank = SEVERITY_RANK[existing?.mlSeverity] ?? -1;
    const newRank = SEVERITY_RANK[enrichment.severity] ?? -1;
    if (newRank >= prevRank) $set.mlSeverity = enrichment.severity;
  }
  if (enrichment.mitre?.tactic) {
    $addToSet.mlTactics = enrichment.mitre.tactic;
  }
  if (enrichment.threatActor?.group && enrichment.threatActor.group !== 'Unknown') {
    $set.mlThreatActor = enrichment.threatActor.group;
    $set.mlThreatActorConfidence = enrichment.threatActor.confidence;
  }
  if (enrichment.styleSignature) {
    $addToSet.mlStyleSignatures = enrichment.styleSignature;
  }
  if (Array.isArray(enrichment.modelsUsed) && enrichment.modelsUsed.length) {
    $addToSet.mlModelsUsed = { $each: enrichment.modelsUsed };
  }

  const update = {};
  if (Object.keys($set).length) update.$set = $set;
  if (Object.keys($max).length) update.$max = $max;
  if (Object.keys($addToSet).length) update.$addToSet = $addToSet;
  if (!Object.keys(update).length) return;

  await AttackerProfile.updateOne({ ip: attackerIp }, update, { upsert: false });
}

/**
 * Enrich a persisted event. Safe to call without awaiting (fire-and-forget):
 * it swallows every error so it can never break the write pipeline.
 *
 * @param {object} eventDoc  the saved AttackEvent (needs eventID)
 * @param {object} attackData the raw trap payload
 */
async function enrichEventSafe(eventDoc, attackData) { // skipcq: JS-0067, JS-R1005
  if (!ENABLED) return null;
  const eventID = eventDoc?.eventID;
  const attackerIp = attackData?.attackerIp;
  if (!eventID || !attackerIp) return null;

  try {
    const trapSequence = await recentTrapSequence(attackerIp, attackData.traceId);
    const fp = attackData.fingerprint || {};
    const payload = {
      trapType: attackData.trapType,
      payload: typeof attackData.payload === 'string' ? attackData.payload : JSON.stringify(attackData.payload ?? ''),
      method: attackData.method,
      path: attackData.path,
      userAgent: attackData.userAgent,
      referer: attackData.referer,
      attackerIp,
      trapSequence,
      isBot: Boolean(fp.isBot),
    };

    const enrichment = await callEnrich(payload);
    if (!enrichment || enrichment.error) return null;

    await persistEnrichment(eventID, attackerIp, enrichment);

    attackLog.info('TELEMETRY', 'ml_enrichment_applied', {
      ip: attackerIp,
      event_id: eventID,
      trap: attackData.trapType,
      severity: enrichment.severity,
      risk: enrichment.riskScore,
      tactic: enrichment.mitre?.tactic,
      actor: enrichment.threatActor?.group,
      engine: enrichment.engine,
    });
    return enrichment;
  } catch (err) {
    attackLog.warn('TELEMETRY', 'ml_enrichment_skipped', {
      ip: attackerIp,
      event_id: eventID,
      error: err?.message || String(err),
    });
    return null;
  }
}

module.exports = { enrichEventSafe };
