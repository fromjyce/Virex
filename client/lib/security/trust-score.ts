/**
 * Dynamic trust scoring model for peers.
 *
 * Trust Score = f(success_rate, latency, integrity, anomaly_score)
 *
 * Weights are empirically chosen; the composite score drives peer selection
 * and auto-blacklisting (threshold: 15.0).
 */

export interface PeerMetrics {
  successRate:   number;  // 0–100 %
  latency:       number;  // ms (lower is better)
  packetLoss:    number;  // 0–100 %
  anomalyScore:  number;  // 0–1 (lower is better)
  integrityScore: number; // 0–100 (hash-pass rate)
  uptime:         number; // seconds (longer is better)
}

const WEIGHTS = {
  successRate:   0.30,
  latency:       0.20,
  packetLoss:    0.15,
  anomalyScore:  0.20,
  integrityScore: 0.10,
  uptime:        0.05,
} as const;

const MAX_LATENCY  = 300;   // ms beyond which score = 0
const MIN_UPTIME   = 60;    // seconds for minimal score
const MAX_UPTIME   = 86400; // one day = full uptime score

export function computeTrustScore(m: PeerMetrics): number {
  const successComponent   = m.successRate;
  const latencyComponent   = Math.max(0, 100 - (m.latency / MAX_LATENCY) * 100);
  const packetComponent    = Math.max(0, 100 - m.packetLoss * 10);
  const anomalyComponent   = (1 - m.anomalyScore) * 100;
  const integrityComponent = m.integrityScore;
  const uptimeRatio        = Math.min(m.uptime, MAX_UPTIME) / MAX_UPTIME;
  const uptimeComponent    = m.uptime < MIN_UPTIME ? 0 : uptimeRatio * 100;

  const score =
    successComponent   * WEIGHTS.successRate   +
    latencyComponent   * WEIGHTS.latency       +
    packetComponent    * WEIGHTS.packetLoss    +
    anomalyComponent   * WEIGHTS.anomalyScore  +
    integrityComponent * WEIGHTS.integrityScore +
    uptimeComponent    * WEIGHTS.uptime;

  return Math.max(0, Math.min(100, score));
}

/**
 * Incremental update: adjust score after a single transfer event.
 * Applied after each chunk delivery to keep scores responsive.
 */
export function updateScoreOnEvent(
  currentScore: number,
  event: 'success' | 'failure' | 'integrity_fail' | 'timeout'
): number {
  const deltas: Record<string, number> = {
    success:        +0.8,
    failure:        -2.5,
    integrity_fail: -8.0,
    timeout:        -4.0,
  };
  const delta = deltas[event] ?? 0;
  return Math.max(0, Math.min(100, currentScore + delta));
}

/**
 * Weighted peer ranking for the ML peer-selection layer.
 * Returns peers sorted by composite score (descending).
 */
export function rankPeers<T extends { trustScore: number; latency: number; bandwidth: number }>(
  peers: T[]
): T[] {
  return [...peers].sort((a, b) => {
    const scoreA = a.trustScore * 0.5 + (1 - a.latency / MAX_LATENCY) * 30 + (a.bandwidth / 500) * 20;
    const scoreB = b.trustScore * 0.5 + (1 - b.latency / MAX_LATENCY) * 30 + (b.bandwidth / 500) * 20;
    return scoreB - scoreA;
  });
}

export const BLACKLIST_THRESHOLD  = 15;
export const FLAGGED_THRESHOLD    = 50;

export function deriveStatus(score: number): 'trusted' | 'flagged' | 'blacklisted' {
  if (score <= BLACKLIST_THRESHOLD) return 'blacklisted';
  if (score <= FLAGGED_THRESHOLD)   return 'flagged';
  return 'trusted';
}
