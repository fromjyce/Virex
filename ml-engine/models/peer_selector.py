"""
Peer Selection Model
====================
Ranks candidate peers for a transfer using a two-stage approach:

Stage 1 — Weighted scoring (always available, no training required):
    composite = w_trust * trust_score
              + w_bw    * norm(bandwidth)
              + w_lat   * (1 - norm(latency))
              + w_loss  * (1 - norm(packet_loss))
              + w_anom  * (1 - anomaly_score)

Stage 2 — XGBoost ranker (activated once ≥100 labeled samples exist):
    Trained on historical transfer outcomes (label: transfer_success_rate).
    Falls back to weighted scoring when insufficient data.
"""

import numpy as np
from dataclasses import dataclass

try:
    import xgboost as xgb
    XGB_AVAILABLE = True
except ImportError:
    XGB_AVAILABLE = False


WEIGHTS = {
    "trust_score":     0.35,
    "bandwidth_mbps":  0.25,
    "latency_ms":      0.20,
    "packet_loss_pct": 0.12,
    "anomaly_score":   0.08,
}

MAX_LATENCY  = 300.0
MAX_BANDWIDTH = 500.0
MAX_LOSS      = 20.0


@dataclass
class ScoredPeer:
    peer_id:         str
    composite_score: float
    trust_score:     float
    anomaly_score:   float


class PeerSelector:
    def __init__(self) -> None:
        self._model = None
        self._model_ready = False

    def rank(
        self,
        peers: list[dict],
        top_k: int = 5,
    ) -> list[ScoredPeer]:
        """Return top-k peers ranked by composite score (descending)."""
        if not peers:
            return []

        if self._model_ready and XGB_AVAILABLE:
            return self._rank_xgb(peers, top_k)
        return self._rank_weighted(peers, top_k)

    def _rank_weighted(self, peers: list[dict], top_k: int) -> list[ScoredPeer]:
        scored: list[ScoredPeer] = []
        for p in peers:
            trust  = p.get("trust_score", 50.0)
            bw     = min(p.get("bandwidth_mbps", 0.0), MAX_BANDWIDTH) / MAX_BANDWIDTH * 100
            lat    = max(0.0, 100.0 - (min(p.get("latency_ms", 300.0), MAX_LATENCY) / MAX_LATENCY) * 100)
            loss   = max(0.0, 100.0 - (min(p.get("packet_loss_pct", 0.0), MAX_LOSS) / MAX_LOSS) * 100)
            anom   = (1.0 - p.get("anomaly_score", 0.0)) * 100

            score = (
                WEIGHTS["trust_score"]     * trust +
                WEIGHTS["bandwidth_mbps"]  * bw    +
                WEIGHTS["latency_ms"]      * lat   +
                WEIGHTS["packet_loss_pct"] * loss  +
                WEIGHTS["anomaly_score"]   * anom
            )
            scored.append(ScoredPeer(
                peer_id=p["peer_id"],
                composite_score=round(score, 3),
                trust_score=trust,
                anomaly_score=p.get("anomaly_score", 0.0),
            ))

        scored.sort(key=lambda s: s.composite_score, reverse=True)
        return scored[:top_k]

    def _rank_xgb(self, peers: list[dict], top_k: int) -> list[ScoredPeer]:
        features = np.array([[
            p.get("trust_score", 50.0),
            p.get("bandwidth_mbps", 0.0),
            p.get("latency_ms", 300.0),
            p.get("packet_loss_pct", 0.0),
            p.get("anomaly_score", 0.5),
            p.get("success_rate", 50.0),
            p.get("uptime_seconds", 0.0),
        ] for p in peers], dtype=np.float32)

        dmat   = xgb.DMatrix(features)
        scores = self._model.predict(dmat)

        scored = [
            ScoredPeer(
                peer_id=peers[i]["peer_id"],
                composite_score=float(scores[i]),
                trust_score=peers[i].get("trust_score", 50.0),
                anomaly_score=peers[i].get("anomaly_score", 0.5),
            )
            for i in range(len(peers))
        ]
        scored.sort(key=lambda s: s.composite_score, reverse=True)
        return scored[:top_k]

    def fit(self, X: np.ndarray, y: np.ndarray) -> None:
        """Train the XGBoost ranker. X shape: (n_peers, 7), y: success_rate (0–100)."""
        if not XGB_AVAILABLE or len(X) < 100:
            return
        dtrain = xgb.DMatrix(X, label=y)
        params = {
            "objective":        "reg:squarederror",
            "max_depth":        4,
            "learning_rate":    0.05,
            "n_estimators":     200,
            "subsample":        0.8,
            "colsample_bytree": 0.8,
            "eval_metric":      "rmse",
            "verbosity":        0,
        }
        self._model = xgb.train(params, dtrain, num_boost_round=200)
        self._model_ready = True

    @property
    def model_name(self) -> str:
        return "xgboost-ranker" if self._model_ready else "weighted-scoring"
