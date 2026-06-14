"""Request / response models for the enrichment API."""

from __future__ import annotations

from typing import Optional
from pydantic import BaseModel, Field


class EnrichRequest(BaseModel):
    """A single trap event handed to us by the telemetry service."""

    trapType: str = Field(default="RECON")
    payload: Optional[str] = None
    method: Optional[str] = None
    path: Optional[str] = None
    userAgent: Optional[str] = None
    referer: Optional[str] = None
    attackerIp: Optional[str] = None
    # Ordered trap types seen for this attacker/trace so far (oldest → newest).
    trapSequence: list[str] = Field(default_factory=list)
    isBot: Optional[bool] = None


class PayloadClassification(BaseModel):
    label: str
    attackType: str
    confidence: float
    model: str


class LogClassification(BaseModel):
    label: str
    confidence: float
    model: str


class MitreTechnique(BaseModel):
    id: str
    name: str
    tactic: str
    score: float


class MitreResult(BaseModel):
    tactic: str
    tacticConfidence: float
    techniques: list[MitreTechnique] = Field(default_factory=list)
    model: str


class ActorCandidate(BaseModel):
    group: str
    score: float


class ThreatActorResult(BaseModel):
    group: str
    confidence: float
    candidates: list[ActorCandidate] = Field(default_factory=list)
    model: str


class ModelStatus(BaseModel):
    key: str
    repo: str
    loaded: bool
    error: Optional[str] = None


class MlEnrichment(BaseModel):
    riskScore: int
    severity: str  # benign | suspicious | malicious
    engine: str  # ml | heuristic | hybrid
    payload: Optional[PayloadClassification] = None
    log: Optional[LogClassification] = None
    mitre: Optional[MitreResult] = None
    threatActor: Optional[ThreatActorResult] = None
    styleSignature: Optional[str] = None
    modelsUsed: list[str] = Field(default_factory=list)
    computedAt: str
