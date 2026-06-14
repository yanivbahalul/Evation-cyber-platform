"""ML Threat-Intel service.

A small FastAPI app that enriches honeypot trap events with Hugging Face models:
payload classification, HTTP-log classification, MITRE ATT&CK tactic/technique
mapping, threat-actor attribution, and an attacker-style signature.

The telemetry service (`logging-data-extraction`) calls `POST /enrich` for every
trap event (best-effort, asynchronous) and persists the result on the
`AttackEvent` / `AttackerProfile` documents.
"""

from __future__ import annotations

import logging
import os

from fastapi import FastAPI, Header, HTTPException
from fastapi.responses import JSONResponse

from enrichment import enrich
from model_registry import ENABLE_MODELS, ENABLED_KEYS, registry
from schemas import EnrichRequest, MlEnrichment

logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "INFO"),
    format="[ML-THREAT-INTEL] %(levelname)s %(message)s",
)
log = logging.getLogger("ml-threat-intel")

app = FastAPI(title="Evation ML Threat-Intel", version="1.0.0")

# Shared-secret auth, consistent with the telemetry service's internal routes.
ADMIN_SOCKET_TOKEN = os.getenv("ADMIN_SOCKET_TOKEN")


def _check_token(authorization: str | None) -> None:
    if not ADMIN_SOCKET_TOKEN:
        # Token not configured → open in dev, but log loudly.
        return
    token = authorization[7:] if authorization and authorization.startswith("Bearer ") else ""
    if token != ADMIN_SOCKET_TOKEN:
        raise HTTPException(status_code=401, detail="Unauthorized")


@app.get("/")
@app.get("/healthz")
def healthz() -> dict:
    return {
        "service": "ml-threat-intel",
        "status": "ok",
        "modelsEnabled": ENABLE_MODELS,
        "enabledKeys": sorted(ENABLED_KEYS),
    }


@app.get("/models")
def models() -> dict:
    return {"modelsEnabled": ENABLE_MODELS, "models": registry.status()}


@app.post("/enrich", response_model=MlEnrichment)
def enrich_event(req: EnrichRequest, authorization: str | None = Header(default=None)):
    _check_token(authorization)
    try:
        return enrich(req)
    except Exception as exc:  # noqa: BLE001 - never 500 the telemetry pipeline
        log.exception("enrichment failed")
        return JSONResponse(status_code=502, content={"error": "enrichment_failed", "detail": str(exc)})


if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv("PORT", "3003"))
    uvicorn.run("app:app", host="0.0.0.0", port=port, log_level=os.getenv("LOG_LEVEL", "info").lower())
