"""Orchestration: turn a trap event into a unified `MlEnrichment`.

Each signal (payload, log, MITRE tactic + techniques, threat-actor, style) is
produced by its Hugging Face model when available, and falls back to a
deterministic heuristic otherwise. The final risk score blends model confidence
with the trap's intrinsic severity.
"""

from __future__ import annotations

from datetime import datetime, timezone

import heuristics as H
from model_registry import registry
from schemas import (
    ActorCandidate,
    EnrichRequest,
    LogClassification,
    MitreResult,
    MitreTechnique,
    MlEnrichment,
    PayloadClassification,
    ThreatActorResult,
)


def _context_text(req: EnrichRequest) -> str:
    """Compose a single string the text models can reason over."""
    parts = [
        f"trap={req.trapType}",
        f"method={req.method or ''}",
        f"path={req.path or ''}",
        f"payload={req.payload or ''}",
        f"ua={req.userAgent or ''}",
    ]
    if req.trapSequence:
        parts.append("chain=" + " -> ".join(req.trapSequence))
    return " ".join(p for p in parts if p)


def enrich(req: EnrichRequest) -> MlEnrichment:
    text = _context_text(req)
    payload_text = req.payload or req.path or text
    used: list[str] = []
    engine = "heuristic"

    # --- 1. Payload classification ----------------------------------------
    ml_payload = registry.payload_predict(payload_text)
    if ml_payload:
        label, conf, repo = ml_payload
        attack_type = _label_to_attack(label, req.trapType)
        payload = PayloadClassification(
            label=_binary(label), attackType=attack_type, confidence=round(conf, 3), model=repo,
        )
        used.append(repo)
        engine = "ml"
    else:
        h = H.classify_payload(payload_text, req.trapType)
        payload = PayloadClassification(
            label=h["label"], attackType=h["attackType"], confidence=h["confidence"],
            model="heuristic",
        )
    payload_conf = payload.confidence if payload.label == "malicious" else 1 - payload.confidence

    # --- 2. HTTP-log classification ---------------------------------------
    ml_log = registry.log_predict(text)
    if ml_log:
        label, conf, repo = ml_log
        log_res = LogClassification(label=label, confidence=round(conf, 3), model=repo)
        used.append(repo)
        engine = "ml"
    else:
        h = H.classify_log(text, req.trapType)
        log_res = LogClassification(label=h["label"], confidence=h["confidence"], model="heuristic")

    # --- 3. MITRE tactic + techniques -------------------------------------
    mitre = _build_mitre(req, text, used)
    if mitre.model != "heuristic":
        engine = "ml"

    # --- 4. Threat-actor attribution --------------------------------------
    actor = _build_actor(req, text, used)
    if actor.model != "heuristic":
        engine = "ml"

    # --- 5. Attacker style signature (SecBERT) ----------------------------
    style_sig = None
    ml_style = registry.style_signature(text)
    if ml_style:
        style_sig, repo = ml_style
        used.append(repo)
        engine = "ml"

    # --- 6. Risk score + severity -----------------------------------------
    score = H.risk_score(
        req.trapType, payload_conf, bool(req.isBot), len(req.trapSequence),
    )
    severity = H.severity_from_score(score)

    if used and engine == "ml" and any(m == "heuristic" for m in
                                       (payload.model, log_res.model, mitre.model, actor.model)):
        engine = "hybrid"

    return MlEnrichment(
        riskScore=score,
        severity=severity,
        engine=engine,
        payload=payload,
        log=log_res,
        mitre=mitre,
        threatActor=actor,
        styleSignature=style_sig,
        modelsUsed=sorted(set(used)),
        computedAt=datetime.now(timezone.utc).isoformat(),
    )


def _build_mitre(req: EnrichRequest, text: str, used: list[str]) -> MitreResult:
    techniques: list[MitreTechnique] = []
    model_name = "heuristic"

    ml_tech = registry.mitre_techniques(text)
    if ml_tech:
        items, repo = ml_tech
        techniques = [MitreTechnique(**i) for i in items]
        used.append(repo)
        model_name = repo

    ml_tactic = registry.mitre_tactic_predict(text)
    if ml_tactic:
        tactic, conf, repo = ml_tactic
        used.append(repo)
        if not techniques:
            h = H.map_mitre(req.trapType, req.trapSequence)
            techniques = [MitreTechnique(**t) for t in h["techniques"]]
        return MitreResult(tactic=tactic, tacticConfidence=round(conf, 3),
                           techniques=techniques, model=repo)

    # No tactic model — derive tactic from top technique or heuristic.
    if techniques:
        return MitreResult(tactic=techniques[0].tactic, tacticConfidence=techniques[0].score,
                           techniques=techniques, model=model_name)
    h = H.map_mitre(req.trapType, req.trapSequence)
    return MitreResult(tactic=h["tactic"], tacticConfidence=h["tacticConfidence"],
                       techniques=[MitreTechnique(**t) for t in h["techniques"]], model="heuristic")


def _build_actor(req: EnrichRequest, text: str, used: list[str]) -> ThreatActorResult:
    ml_actor = registry.actor_predict(text)
    if ml_actor:
        group, conf, candidates, repo = ml_actor
        used.append(repo)
        return ThreatActorResult(
            group=group, confidence=round(conf, 3),
            candidates=[ActorCandidate(**c) for c in candidates], model=repo,
        )
    h = H.attribute_actor(req.trapSequence or [req.trapType], req.userAgent or "")
    return ThreatActorResult(
        group=h["group"], confidence=h["confidence"],
        candidates=[ActorCandidate(**c) for c in h["candidates"]], model="heuristic",
    )


def _binary(label: str) -> str:
    low = (label or "").lower()
    if low in ("benign", "0", "label_0", "safe", "normal", "non-attack"):
        return "benign"
    return "malicious"


def _label_to_attack(label: str, trap_type: str) -> str:
    """Map a model's class label onto our trap vocabulary where possible."""
    low = (label or "").lower()
    table = {
        "sql": "SQL_INJECTION", "sqli": "SQL_INJECTION",
        "xss": "XSS", "script": "XSS",
        "traversal": "PATH_TRAVERSAL", "lfi": "PATH_TRAVERSAL",
        "command": "RECON", "rce": "RECON",
        "ssrf": "SSRF",
    }
    for needle, attack in table.items():
        if needle in low:
            return attack
    return H.normalize_trap(trap_type)
