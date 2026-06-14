"""Deterministic, dependency-free fallbacks.

These keep the service fully functional when the Hugging Face models are
disabled or fail to download (CI, laptops without GPUs, air-gapped demo boxes).
Every model path degrades to one of these helpers.
"""

from __future__ import annotations

import re

from catalog import (
    MITRE_TECHNIQUES,
    TRAP_SEVERITY,
    TRAP_TO_TECHNIQUE,
)

_TECH_BY_ID = {t["id"]: t for t in MITRE_TECHNIQUES}

# Lightweight payload signatures (mirror the gateway regex, kept independent).
_SIGNATURES: list[tuple[str, str]] = [
    ("SQL_INJECTION", r"(\bUNION\b.*\bSELECT\b|\bOR\b\s+['\"]?\d+['\"]?\s*=|--|\bSLEEP\s*\(|information_schema|\bDROP\s+TABLE\b)"),
    ("XSS", r"(<script|javascript:|onerror=|onload=|alert\(|document\.cookie)"),
    ("PATH_TRAVERSAL", r"(\.\./|\.\.\\|%2e%2e|/etc/passwd|file://)"),
    ("SSRF", r"(169\.254\.|metadata\.google|/latest/meta-data|127\.0\.0\.1|localhost:\d+)"),
    ("DATA_BOMB", r"(backup\.zip|\.zip\b|full.?backup|export=|dump=)"),
    ("RECON", r"(wp-admin|wp-login|\.env|phpmyadmin|/\.git|swagger|actuator)"),
]
_SCANNER_UA = re.compile(r"sqlmap|nikto|acunetix|nmap|masscan|zgrab|wpscan|dirbuster|gobuster|burp", re.I)


def classify_payload(text: str, trap_type: str) -> dict:
    """Return {label, attackType, confidence} from regex signatures + trap hint."""
    blob = text or ""
    for attack, pat in _SIGNATURES:
        if re.search(pat, blob, re.I):
            return {"label": "malicious", "attackType": attack, "confidence": 0.72}

    norm = normalize_trap(trap_type)
    if norm in TRAP_SEVERITY:
        return {"label": "malicious", "attackType": norm, "confidence": 0.55}
    return {"label": "benign", "attackType": "NONE", "confidence": 0.5}


def classify_log(text: str, trap_type: str) -> dict:
    payload = classify_payload(text, trap_type)
    label = "malicious" if payload["label"] == "malicious" else "benign"
    return {"label": label, "confidence": payload["confidence"]}


def normalize_trap(trap_type: str) -> str:
    mapping = {"SQLI": "SQL_INJECTION", "XSS": "XSS", "XSS_PROBE": "XSS"}
    return mapping.get((trap_type or "").upper(), (trap_type or "").upper())


def map_mitre(trap_type: str, trap_sequence: list[str]) -> dict:
    """Pick the most likely technique/tactic from the trap (+ sequence context)."""
    tid = TRAP_TO_TECHNIQUE.get((trap_type or "").upper())
    tech = _TECH_BY_ID.get(tid) if tid else None

    techniques = []
    seen = set()
    for tt in [trap_type, *trap_sequence]:
        cand_id = TRAP_TO_TECHNIQUE.get((tt or "").upper())
        if cand_id and cand_id not in seen and cand_id in _TECH_BY_ID:
            seen.add(cand_id)
            c = _TECH_BY_ID[cand_id]
            techniques.append({
                "id": c["id"], "name": c["name"],
                "tactic": c["tactic"], "score": 0.6,
            })

    tactic = tech["tactic"] if tech else "Reconnaissance"
    return {"tactic": tactic, "tacticConfidence": 0.6 if tech else 0.4, "techniques": techniques[:5]}


def attribute_actor(trap_sequence: list[str], user_agent: str) -> dict:
    """Very rough actor hinting: scanners → automated, full kill chains → targeted."""
    ua = (user_agent or "").lower()
    if _SCANNER_UA.search(ua):
        return {"group": "Automated/Commodity", "confidence": 0.5,
                "candidates": [{"group": "Automated/Commodity", "score": 0.5}]}
    chain = {normalize_trap(t) for t in trap_sequence}
    if {"SQL_INJECTION", "RECON"}.issubset(chain) or len(chain) >= 3:
        return {"group": "Targeted/Unknown", "confidence": 0.35,
                "candidates": [{"group": "Targeted/Unknown", "score": 0.35}]}
    return {"group": "Unknown", "confidence": 0.2,
            "candidates": [{"group": "Unknown", "score": 0.2}]}


def risk_score(trap_type: str, payload_conf: float, is_bot: bool, chain_len: int) -> int:
    base = TRAP_SEVERITY.get(normalize_trap(trap_type), 30)
    score = base * (0.6 + 0.4 * payload_conf)
    if is_bot:
        score += 10
    score += min(chain_len, 5) * 3  # escalating kill chain → higher risk
    return max(0, min(100, round(score)))


def severity_from_score(score: int) -> str:
    if score >= 70:
        return "malicious"
    if score >= 40:
        return "suspicious"
    return "benign"
