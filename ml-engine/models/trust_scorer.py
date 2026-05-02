"""
Trust Scorer
============
Computes a dynamic trust score for each peer.

Trust Score = Σ (weight_i × component_i)   ∈ [0, 100]

Components and weights:
  success_rate    (0.30) — ratio of successful chunk deliveries
  latency         (0.20) — normalized, lower is better
  packet_loss     (0.15) — normalized, lower is better
  anomaly_score   (0.20) — inverted (lower anomaly → higher trust)
  integrity_score (0.10) — hash-pass rate
  uptime          (0.05) — capped at 1 day, log-scaled

Auto-blacklist:  score ≤ 15
Flagged:         15 < score ≤ 50
Trusted:         score > 50
"""

from dataclasses import dataclass
import math


WEIGHTS = {
    "success_rate":   0.30,
    "latency":        0.20,
    "packet_loss":    0.15,
    "anomaly_score":  0.20,
    "integrity":      0.10,
    "uptime":         0.05,
}

MAX_LATENCY    = 300.0
MAX_LOSS       = 20.0
MAX_UPTIME_S   = 86_400.0   # 1 day
MIN_UPTIME_S   = 60.0

BLACKLIST_THRESHOLD = 15.0
FLAGGED_THRESHOLD   = 50.0


@dataclass
class TrustComponents:
    success_rate:   float
    latency:        float
    packet_loss:    float
    anomaly_score:  float
    integrity:      float
    uptime:         float


@dataclass
class TrustResult:
    peer_id:    str
    score:      float
    status:     str
    components: TrustComponents


class TrustScorer:
    def score(
        self,
        peer_id:          str,
        success_rate:     float,
        latency_ms:       float,
        packet_loss_pct:  float,
        anomaly_score:    float,
        integrity_score:  float = 100.0,
        uptime_seconds:   float = 0.0,
        previous_score:   float | None = None,
    ) -> TrustResult:
        c_success    = float(max(0.0, min(100.0, success_rate)))
        c_latency    = float(max(0.0, 100.0 - (min(latency_ms, MAX_LATENCY) / MAX_LATENCY) * 100))
        c_loss       = float(max(0.0, 100.0 - (min(packet_loss_pct, MAX_LOSS) / MAX_LOSS) * 100))
        c_anomaly    = float((1.0 - min(max(anomaly_score, 0.0), 1.0)) * 100)
        c_integrity  = float(max(0.0, min(100.0, integrity_score)))

        # Log-scale uptime to reward early uptime more
        if uptime_seconds < MIN_UPTIME_S:
            c_uptime = 0.0
        else:
            c_uptime = float(min(
                math.log(uptime_seconds / MIN_UPTIME_S) /
                math.log(MAX_UPTIME_S / MIN_UPTIME_S) * 100,
                100.0
            ))

        raw_score = (
            WEIGHTS["success_rate"]  * c_success   +
            WEIGHTS["latency"]       * c_latency   +
            WEIGHTS["packet_loss"]   * c_loss      +
            WEIGHTS["anomaly_score"] * c_anomaly   +
            WEIGHTS["integrity"]     * c_integrity +
            WEIGHTS["uptime"]        * c_uptime
        )

        # Exponential moving average with previous score (α=0.3) for smoothness
        if previous_score is not None:
            alpha = 0.3
            final_score = alpha * raw_score + (1 - alpha) * previous_score
        else:
            final_score = raw_score

        final_score = round(max(0.0, min(100.0, final_score)), 2)
        status = self._derive_status(final_score)

        return TrustResult(
            peer_id=peer_id,
            score=final_score,
            status=status,
            components=TrustComponents(
                success_rate=round(c_success,   2),
                latency=     round(c_latency,   2),
                packet_loss= round(c_loss,      2),
                anomaly_score=round(c_anomaly,  2),
                integrity=   round(c_integrity, 2),
                uptime=      round(c_uptime,    2),
            ),
        )

    def _derive_status(self, score: float) -> str:
        if score <= BLACKLIST_THRESHOLD:
            return "blacklisted"
        if score <= FLAGGED_THRESHOLD:
            return "flagged"
        return "trusted"

    def batch_score(self, peers: list[dict]) -> list[TrustResult]:
        return [
            self.score(
                peer_id=         p["peer_id"],
                success_rate=    p.get("success_rate", 50.0),
                latency_ms=      p.get("latency_ms", 150.0),
                packet_loss_pct= p.get("packet_loss_pct", 5.0),
                anomaly_score=   p.get("anomaly_score", 0.5),
                integrity_score= p.get("integrity_score", 100.0),
                uptime_seconds=  p.get("uptime_seconds", 0.0),
                previous_score=  p.get("trust_score"),
            )
            for p in peers
        ]
