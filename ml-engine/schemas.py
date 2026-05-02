from pydantic import BaseModel, Field
from typing import Literal


class PeerFeatures(BaseModel):
    peer_id: str
    latency_ms: float = Field(..., ge=0)
    bandwidth_mbps: float = Field(..., ge=0)
    packet_loss_pct: float = Field(..., ge=0, le=100)
    success_rate: float = Field(..., ge=0, le=100)
    uptime_seconds: float = Field(..., ge=0)
    anomaly_score: float = Field(0.0, ge=0, le=1)
    trust_score: float = Field(50.0, ge=0, le=100)


class PeerSelectionRequest(BaseModel):
    peers: list[PeerFeatures]
    top_k: int = Field(5, ge=1, le=50)


class RankedPeer(BaseModel):
    peer_id: str
    composite_score: float
    trust_score: float
    anomaly_score: float
    rank: int


class PeerSelectionResponse(BaseModel):
    ranked_peers: list[RankedPeer]
    model_used: str


class AnomalyDetectionRequest(BaseModel):
    peers: list[PeerFeatures]


class AnomalyResult(BaseModel):
    peer_id: str
    is_anomaly: bool
    anomaly_score: float
    reason: str


class AnomalyDetectionResponse(BaseModel):
    results: list[AnomalyResult]
    model_version: str


class TrustScoreRequest(BaseModel):
    peer_id: str
    success_rate: float = Field(..., ge=0, le=100)
    latency_ms: float = Field(..., ge=0)
    packet_loss_pct: float = Field(..., ge=0, le=100)
    anomaly_score: float = Field(..., ge=0, le=1)
    integrity_score: float = Field(100.0, ge=0, le=100)
    uptime_seconds: float = Field(..., ge=0)
    previous_score: float | None = None


class TrustScoreResponse(BaseModel):
    peer_id: str
    trust_score: float
    status: Literal["trusted", "flagged", "blacklisted"]
    components: dict[str, float]


class BatchTrustRequest(BaseModel):
    peers: list[TrustScoreRequest]


class BatchTrustResponse(BaseModel):
    results: list[TrustScoreResponse]
