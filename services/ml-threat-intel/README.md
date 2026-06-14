# ML Threat-Intel service

FastAPI microservice that enriches honeypot trap events with machine-learning
threat intelligence. It is the only place Hugging Face models run; the telemetry
service (`services/logging-data-extraction`) calls it best-effort per trap event
and persists the result on the `AttackEvent` / `AttackerProfile` documents, which
the admin **Investigate** tab then surfaces.

> Owner: Yaniv (admin panel + investigation). Branch: `yaniv-test`.

## Models used (all integrated)

| Key | Hugging Face repo | Role |
|-----|-------------------|------|
| `payload` | [`redauzhang/common-injection-payload-classfication`](https://huggingface.co/redauzhang/common-injection-payload-classfication) | CodeBERT — SQLi/XSS/traversal/command-injection payload classifier |
| `payload_sqli_xss` | [`Dr-KeK/sqli-xss-models`](https://huggingface.co/Dr-KeK/sqli-xss-models) | Specialised SQLi + XSS classifier (~99% acc) |
| `log` | [`Shoriful025/cyber_threat_log_classifier`](https://huggingface.co/Shoriful025/cyber_threat_log_classifier) | RoBERTa — 5-class HTTP/audit-log classifier |
| `mitre_tactic` | [`sarahwei/MITRE-v15-tactic-bert-case-based`](https://huggingface.co/sarahwei/MITRE-v15-tactic-bert-case-based) | MITRE ATT&CK v15 tactic classification |
| `attack_bert` | [`basel/ATTACK-BERT`](https://huggingface.co/basel/ATTACK-BERT) | Sentence-Transformer — maps actions → ATT&CK techniques |
| `secbert` | [`jackaduma/SecBERT`](https://huggingface.co/jackaduma/SecBERT) | Security encoder → attacker-style signature for clustering |
| `cyber_groups` | [`selfconstruct3d/mpnet-classification-finetuned-cyber-groups`](https://huggingface.co/selfconstruct3d/mpnet-classification-finetuned-cyber-groups) | Threat-actor / APT group attribution |

Each model is **lazily loaded and isolated** — if a repo is missing, gated, or
too heavy for the host, that signal falls back to a deterministic heuristic and
the service keeps working. With `ML_ENABLE_MODELS=false` (the default) the whole
service runs heuristic-only, so it boots instantly for CI and demos.

## Run locally

```bash
cd services/ml-threat-intel
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt        # core only — heuristic mode
# pip install -r requirements-ml.txt   # optional: real Hugging Face models
cp .env.example .env            # then edit ADMIN_SOCKET_TOKEN
python app.py                   # listens on :3003
```

> The heavy ML stack (torch/transformers) lives in `requirements-ml.txt` and is
> only required when `ML_ENABLE_MODELS=true`. The default build/run is fully
> functional on heuristics alone.

Smoke test:

```bash
curl -s -X POST http://localhost:3003/enrich \
  -H "Authorization: Bearer admin-secret" \
  -H "Content-Type: application/json" \
  -d '{"trapType":"SQLI","payload":"admin'\'' OR 1=1--","path":"/gateway/login","trapSequence":["RECON","SQLI"]}' | jq
```

Enable the real models (downloads weights on first request):

```bash
pip install -r requirements-ml.txt
ML_ENABLE_MODELS=true python app.py
# or a subset:
ML_ENABLE_MODELS=true ML_ENABLED_MODELS=payload,mitre_tactic,attack_bert python app.py
```

In Docker, set `ML_ENABLE_MODELS=true` in `infra/.env` and `docker compose up
--build` — the heavy stack is baked in only when that flag is true.

## API

- `GET /healthz` — liveness + which models are enabled.
- `GET /models` — per-model load status (loaded / error).
- `POST /enrich` — body = trap event, returns the `MlEnrichment` object.

### `MlEnrichment` shape

```jsonc
{
  "riskScore": 88,
  "severity": "malicious",          // benign | suspicious | malicious
  "engine": "hybrid",              // ml | heuristic | hybrid
  "payload":     { "label": "malicious", "attackType": "SQL_INJECTION", "confidence": 0.97, "model": "..." },
  "log":         { "label": "malicious", "confidence": 0.9, "model": "..." },
  "mitre":       { "tactic": "Initial Access", "tacticConfidence": 0.8,
                   "techniques": [{ "id": "T1190", "name": "...", "tactic": "...", "score": 0.74 }],
                   "model": "..." },
  "threatActor": { "group": "Automated/Commodity", "confidence": 0.5, "candidates": [...], "model": "..." },
  "styleSignature": "a3f1...",     // SecBERT-derived, for cross-IP clustering
  "modelsUsed": ["..."],
  "computedAt": "2026-06-14T10:00:00Z"
}
```

## Security notes (Hugging Face supply chain)

- Builds pin `safetensors` and prefer it over pickle weights.
- Only the trusted repos above are ever loaded (no dynamic repo names).
- Untrusted/oversized models simply fail closed → heuristic fallback, no crash.
- The `/enrich` endpoint requires the shared `ADMIN_SOCKET_TOKEN` bearer.
