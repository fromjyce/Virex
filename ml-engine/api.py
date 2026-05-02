"""
Virex ML Engine — FastAPI service
==================================
Exposes three ML endpoints consumed by the Node.js signaling server
(or directly by the Next.js client via server-side calls):

  POST /api/v1/rank-peers       — ranked peer selection
  POST /api/v1/detect-anomalies — Isolation Forest + rule-based detection
  POST /api/v1/trust-score      — single peer trust computation
  POST /api/v1/trust-score/batch — batch trust computation

Run:
  uvicorn api:app --host 0.0.0.0 --port 8000 --reload
"""

from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from schemas import (
    PeerSelectionRequest, PeerSelectionResponse, RankedPeer,
    AnomalyDetectionRequest, AnomalyDetectionResponse, AnomalyResult,
    TrustScoreRequest, TrustScoreResponse, BatchTrustRequest, BatchTrustResponse,
)
from models import PeerSelector, AnomalyDetector, TrustScorer

# Singletons — initialized on startup
peer_selector:   PeerSelector   | None = None
anomaly_detector: AnomalyDetector | None = None
trust_scorer:    TrustScorer    | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global peer_selector, anomaly_detector, trust_scorer
    peer_selector    = PeerSelector()
    anomaly_detector = AnomalyDetector(contamination=0.05)
    trust_scorer     = TrustScorer()
    yield
    # cleanup (if needed)


app = FastAPI(
    title="Virex ML Engine",
    version="1.0.0",
    description="AI-driven peer selection, anomaly detection & trust scoring for ISPDN",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {
        "status": "ok",
        "models": {
            "peer_selector":    peer_selector.model_name if peer_selector else "unloaded",
            "anomaly_detector": anomaly_detector.model_version if anomaly_detector else "unloaded",
        },
    }


@app.post("/api/v1/rank-peers", response_model=PeerSelectionResponse)
def rank_peers(req: PeerSelectionRequest):
    if not peer_selector:
        raise HTTPException(status_code=503, detail="Model not ready")

    peers_dicts = [p.model_dump() for p in req.peers]
    ranked = peer_selector.rank(peers_dicts, top_k=req.top_k)

    return PeerSelectionResponse(
        ranked_peers=[
            RankedPeer(
                peer_id=r.peer_id,
                composite_score=r.composite_score,
                trust_score=r.trust_score,
                anomaly_score=r.anomaly_score,
                rank=i + 1,
            )
            for i, r in enumerate(ranked)
        ],
        model_used=peer_selector.model_name,
    )


@app.post("/api/v1/detect-anomalies", response_model=AnomalyDetectionResponse)
def detect_anomalies(req: AnomalyDetectionRequest):
    if not anomaly_detector:
        raise HTTPException(status_code=503, detail="Model not ready")

    peers_dicts = [p.model_dump() for p in req.peers]
    results = anomaly_detector.detect(peers_dicts)

    return AnomalyDetectionResponse(
        results=[
            AnomalyResult(
                peer_id=r.peer_id,
                is_anomaly=r.is_anomaly,
                anomaly_score=r.anomaly_score,
                reason=r.reason,
            )
            for r in results
        ],
        model_version=anomaly_detector.model_version,
    )


@app.post("/api/v1/trust-score", response_model=TrustScoreResponse)
def compute_trust(req: TrustScoreRequest):
    if not trust_scorer:
        raise HTTPException(status_code=503, detail="Model not ready")

    result = trust_scorer.score(
        peer_id=         req.peer_id,
        success_rate=    req.success_rate,
        latency_ms=      req.latency_ms,
        packet_loss_pct= req.packet_loss_pct,
        anomaly_score=   req.anomaly_score,
        integrity_score= req.integrity_score,
        uptime_seconds=  req.uptime_seconds,
        previous_score=  req.previous_score,
    )

    return TrustScoreResponse(
        peer_id=result.peer_id,
        trust_score=result.score,
        status=result.status,
        components={
            "success_rate":  result.components.success_rate,
            "latency":       result.components.latency,
            "packet_loss":   result.components.packet_loss,
            "anomaly_score": result.components.anomaly_score,
            "integrity":     result.components.integrity,
            "uptime":        result.components.uptime,
        },
    )


@app.post("/api/v1/trust-score/batch", response_model=BatchTrustResponse)
def batch_trust(req: BatchTrustRequest):
    if not trust_scorer:
        raise HTTPException(status_code=503, detail="Model not ready")

    peers_dicts = [p.model_dump() for p in req.peers]
    results = trust_scorer.batch_score(peers_dicts)

    return BatchTrustResponse(
        results=[
            TrustScoreResponse(
                peer_id=r.peer_id,
                trust_score=r.score,
                status=r.status,
                components={
                    "success_rate":  r.components.success_rate,
                    "latency":       r.components.latency,
                    "packet_loss":   r.components.packet_loss,
                    "anomaly_score": r.components.anomaly_score,
                    "integrity":     r.components.integrity,
                    "uptime":        r.components.uptime,
                },
            )
            for r in results
        ]
    )
