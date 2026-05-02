"""
Anomaly Detector
================
Identifies malicious or unreliable peers using two complementary approaches:

1. Rule-based thresholds (fast, interpretable):
   - anomaly_score > 0.7
   - packet_loss_pct > 10%
   - success_rate < 50%
   - latency_ms > 250

2. Isolation Forest (unsupervised ML):
   - Trained incrementally as peers report stats
   - contamination=0.05 (expect ~5% malicious peers in the wild)
   - Falls back to rules-only when insufficient data (<50 samples)
"""

import numpy as np
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler
from dataclasses import dataclass, field


RULE_THRESHOLDS = {
    "anomaly_score":   0.70,
    "packet_loss_pct": 10.0,
    "success_rate":    50.0,   # below this is anomalous
    "latency_ms":      250.0,
}


@dataclass
class AnomalyResult:
    peer_id:       str
    is_anomaly:    bool
    anomaly_score: float
    reason:        str


class AnomalyDetector:
    def __init__(self, contamination: float = 0.05) -> None:
        self._iso  = IsolationForest(
            n_estimators=100,
            contamination=contamination,
            random_state=42,
            n_jobs=-1,
        )
        self._scaler    = StandardScaler()
        self._fitted    = False
        self._history:  list[list[float]] = []

    # Feature order must be consistent across fit/predict
    FEATURES = [
        "latency_ms",
        "bandwidth_mbps",
        "packet_loss_pct",
        "success_rate",
        "anomaly_score",
        "uptime_seconds",
    ]

    def _to_vector(self, peer: dict) -> list[float]:
        return [peer.get(f, 0.0) for f in self.FEATURES]

    def detect(self, peers: list[dict]) -> list[AnomalyResult]:
        results: list[AnomalyResult] = []
        for peer in peers:
            rule_anomaly, rule_reason = self._rule_check(peer)

            # ML check if model is fitted
            ml_anomaly    = False
            ml_raw_score  = peer.get("anomaly_score", 0.0)
            if self._fitted:
                vec = np.array([self._to_vector(peer)], dtype=np.float32)
                try:
                    scaled = self._scaler.transform(vec)
                    pred   = self._iso.predict(scaled)[0]      # -1 = anomaly
                    score  = -self._iso.score_samples(scaled)[0]  # higher = more anomalous
                    ml_anomaly   = pred == -1
                    ml_raw_score = float(np.clip(score, 0.0, 1.0))
                except Exception:
                    pass

            is_anomaly    = rule_anomaly or ml_anomaly
            final_score   = max(ml_raw_score, 0.9 if rule_anomaly else 0.0)
            reason        = rule_reason if rule_anomaly else (
                "isolation-forest" if ml_anomaly else "normal"
            )

            results.append(AnomalyResult(
                peer_id=peer["peer_id"],
                is_anomaly=is_anomaly,
                anomaly_score=round(final_score, 4),
                reason=reason,
            ))

        # Add to history for incremental training
        self._history.extend([self._to_vector(p) for p in peers])
        if len(self._history) >= 50 and len(self._history) % 25 == 0:
            self._fit_model()

        return results

    def _rule_check(self, peer: dict) -> tuple[bool, str]:
        if peer.get("anomaly_score", 0.0) > RULE_THRESHOLDS["anomaly_score"]:
            return True, f"anomaly_score {peer['anomaly_score']:.3f} > {RULE_THRESHOLDS['anomaly_score']}"
        if peer.get("packet_loss_pct", 0.0) > RULE_THRESHOLDS["packet_loss_pct"]:
            return True, f"packet_loss {peer['packet_loss_pct']:.1f}% > {RULE_THRESHOLDS['packet_loss_pct']}%"
        if peer.get("success_rate", 100.0) < RULE_THRESHOLDS["success_rate"]:
            return True, f"success_rate {peer['success_rate']:.1f}% < {RULE_THRESHOLDS['success_rate']}%"
        if peer.get("latency_ms", 0.0) > RULE_THRESHOLDS["latency_ms"]:
            return True, f"latency {peer['latency_ms']:.0f}ms > {RULE_THRESHOLDS['latency_ms']}ms"
        return False, "normal"

    def _fit_model(self) -> None:
        X = np.array(self._history, dtype=np.float32)
        self._scaler.fit(X)
        self._iso.fit(self._scaler.transform(X))
        self._fitted = True

    @property
    def model_version(self) -> str:
        return f"isolation-forest:samples={len(self._history)}" if self._fitted else "rules-only"
