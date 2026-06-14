"""Lazy, fault-tolerant loader for the Hugging Face models.

Design goals:
  * Load models on first use (cold start stays cheap; the container boots fast).
  * Never crash the service if a repo is missing, gated, or too big for the host
    — each model is isolated in try/except and the caller falls back to
    `heuristics` when a model is unavailable.
  * Only ever load `safetensors` weights from trusted repos (supply-chain
    hygiene — see the README security note).
"""

from __future__ import annotations

import logging
import os
import threading

from catalog import MODELS, MITRE_TECHNIQUES

log = logging.getLogger("ml-threat-intel.models")

# Master switch. When false (default in CI/dev), we never touch torch/HF and the
# service runs purely on heuristics.
ENABLE_MODELS = os.getenv("ML_ENABLE_MODELS", "false").lower() in ("1", "true", "yes")
# Comma-separated allowlist of model keys to actually load (default: all).
ENABLED_KEYS = {
    k.strip()
    for k in os.getenv("ML_ENABLED_MODELS", ",".join(MODELS.keys())).split(",")
    if k.strip()
}


class ModelRegistry:
    """Holds lazily-instantiated pipelines/models keyed by `catalog.MODELS`."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._cache: dict[str, object] = {}
        self._errors: dict[str, str] = {}
        self._technique_embeddings = None

    # --- generic loaders ----------------------------------------------------
    def _load(self, key: str):
        if not ENABLE_MODELS or key not in ENABLED_KEYS:
            return None
        if key in self._cache:
            return self._cache[key]
        if key in self._errors:
            return None

        with self._lock:
            if key in self._cache:
                return self._cache[key]
            spec = MODELS.get(key)
            if not spec:
                return None
            try:
                obj = self._instantiate(spec)
                self._cache[key] = obj
                log.info("loaded model %s (%s)", key, spec["repo"])
                return obj
            except Exception as exc:  # noqa: BLE001 - intentional broad guard
                self._errors[key] = str(exc)
                log.warning("model %s failed to load: %s", key, exc)
                return None

    def _instantiate(self, spec: dict):
        task = spec["task"]
        repo = spec["repo"]
        if task == "sequence-classification":
            from transformers import pipeline  # local import keeps cold start cheap
            kwargs = {"model": repo, "tokenizer": repo, "truncation": True, "top_k": None}
            if spec.get("subfolder"):
                # Some repos nest the transformers checkpoint under a subfolder.
                from transformers import (
                    AutoModelForSequenceClassification,
                    AutoTokenizer,
                )
                sub = spec["subfolder"]
                model = AutoModelForSequenceClassification.from_pretrained(repo, subfolder=sub)
                tok = AutoTokenizer.from_pretrained(repo, subfolder=sub)
                return pipeline("text-classification", model=model, tokenizer=tok, top_k=None)
            return pipeline("text-classification", **kwargs)
        if task == "sentence-embedding":
            from sentence_transformers import SentenceTransformer
            return SentenceTransformer(repo)
        if task == "fill-mask":
            from transformers import AutoModel, AutoTokenizer
            tok = AutoTokenizer.from_pretrained(repo)
            model = AutoModel.from_pretrained(repo)
            return {"model": model, "tokenizer": tok}
        raise ValueError(f"unknown task {task}")

    # --- per-model query helpers -------------------------------------------
    def payload_predict(self, text: str):
        """Binary/multiclass malicious-payload classification.

        Tries the specialised SQLi/XSS model first, then the broad CodeBERT one.
        Returns (label, confidence, repo) or None.
        """
        for key in ("payload_sqli_xss", "payload"):
            pipe = self._load(key)
            if pipe is None:
                continue
            try:
                scores = pipe(text[:512] or "")
                best = _top(scores)
                if best:
                    return best["label"], float(best["score"]), MODELS[key]["repo"]
            except Exception as exc:  # noqa: BLE001
                log.warning("payload_predict via %s failed: %s", key, exc)
        return None

    def log_predict(self, text: str):
        pipe = self._load("log")
        if pipe is None:
            return None
        try:
            best = _top(pipe(text[:512] or ""))
            if best:
                return best["label"], float(best["score"]), MODELS["log"]["repo"]
        except Exception as exc:  # noqa: BLE001
            log.warning("log_predict failed: %s", exc)
        return None

    def mitre_tactic_predict(self, text: str):
        pipe = self._load("mitre_tactic")
        if pipe is None:
            return None
        try:
            best = _top(pipe(text[:512] or ""))
            if best:
                return best["label"], float(best["score"]), MODELS["mitre_tactic"]["repo"]
        except Exception as exc:  # noqa: BLE001
            log.warning("mitre_tactic_predict failed: %s", exc)
        return None

    def mitre_techniques(self, text: str, top_k: int = 3):
        """ATT&CK-BERT cosine similarity against the technique catalog."""
        model = self._load("attack_bert")
        if model is None:
            return None
        try:
            import numpy as np

            if self._technique_embeddings is None:
                descs = [t["desc"] for t in MITRE_TECHNIQUES]
                self._technique_embeddings = model.encode(descs, normalize_embeddings=True)
            q = model.encode([text[:512] or ""], normalize_embeddings=True)[0]
            sims = np.asarray(self._technique_embeddings) @ q
            order = sims.argsort()[::-1][:top_k]
            out = []
            for i in order:
                t = MITRE_TECHNIQUES[int(i)]
                out.append({"id": t["id"], "name": t["name"], "tactic": t["tactic"],
                            "score": round(float(sims[int(i)]), 3)})
            return out, MODELS["attack_bert"]["repo"]
        except Exception as exc:  # noqa: BLE001
            log.warning("mitre_techniques failed: %s", exc)
        return None

    def actor_predict(self, text: str):
        pipe = self._load("cyber_groups")
        if pipe is None:
            return None
        try:
            scores = pipe(text[:512] or "")
            ranked = _rank(scores, top_k=3)
            if ranked:
                top = ranked[0]
                return (top["label"], float(top["score"]),
                        [{"group": r["label"], "score": round(float(r["score"]), 3)} for r in ranked],
                        MODELS["cyber_groups"]["repo"])
        except Exception as exc:  # noqa: BLE001
            log.warning("actor_predict failed: %s", exc)
        return None

    def style_signature(self, text: str):
        """SecBERT CLS embedding → short hex signature for attacker clustering."""
        bundle = self._load("secbert")
        if bundle is None:
            return None
        try:
            import torch

            tok, model = bundle["tokenizer"], bundle["model"]
            enc = tok(text[:256] or "", return_tensors="pt", truncation=True, max_length=256)
            with torch.no_grad():
                out = model(**enc)
            cls = out.last_hidden_state[:, 0, :].squeeze(0)
            # Quantise to a stable 16-char signature so similar styles collide.
            bits = (cls > cls.mean()).int().tolist()[:64]
            sig = "".join(str(b) for b in bits)
            return f"{int(sig or '0', 2):016x}", MODELS["secbert"]["repo"]
        except Exception as exc:  # noqa: BLE001
            log.warning("style_signature failed: %s", exc)
        return None

    # --- introspection ------------------------------------------------------
    def status(self) -> list[dict]:
        out = []
        for key, spec in MODELS.items():
            out.append({
                "key": key,
                "repo": spec["repo"],
                "loaded": key in self._cache,
                "error": self._errors.get(key),
            })
        return out


def _top(scores):
    ranked = _rank(scores, top_k=1)
    return ranked[0] if ranked else None


def _rank(scores, top_k: int = 3):
    """Normalise the various transformers `pipeline` return shapes to a sorted list."""
    if not scores:
        return []
    # `top_k=None` yields a list-of-lists for a single input.
    if isinstance(scores, list) and scores and isinstance(scores[0], list):
        scores = scores[0]
    if isinstance(scores, dict):
        scores = [scores]
    ranked = sorted(scores, key=lambda s: s.get("score", 0), reverse=True)
    return ranked[:top_k]


registry = ModelRegistry()
