export type PeerStatus = 'trusted' | 'flagged' | 'blacklisted';
export type ConnectionState = 'connected' | 'disconnected' | 'connecting';
export type TransferStatus = 'pending' | 'active' | 'paused' | 'complete' | 'failed';
export type AlertSeverity = 'low' | 'medium' | 'high' | 'critical';
export type AlertType =
  | 'anomalous_traffic'
  | 'integrity_failure'
  | 'high_failure_rate'
  | 'reputation_drop'
  | 'ddos_pattern'
  | 'fake_peer'
  | 'poisoned_chunk';

export interface Peer {
  id: string;
  shortId: string;
  status: PeerStatus;
  trustScore: number;      // 0–100
  latency: number;         // ms
  bandwidth: number;       // Mbps
  packetLoss: number;      // %
  uptime: number;          // seconds
  successRate: number;     // %
  anomalyScore: number;    // 0–1
  connectedPeers: string[];
  lastSeen: number;        // unix ms
  publicKey?: string;
  isOwn?: boolean;
}

export interface ChunkProgress {
  index: number;
  total: number;
  received: boolean;
  peerId: string;
}

export interface Transfer {
  id: string;
  fileName: string;
  fileSize: number;        // bytes
  status: TransferStatus;
  direction: 'upload' | 'download';
  progress: number;        // 0–100
  speed: number;           // bytes/s
  sourcePeers: string[];
  chunks: ChunkProgress[];
  startTime: number;
  endTime?: number;
  hash?: string;
}

export interface Alert {
  id: string;
  timestamp: number;
  peerId: string;
  type: AlertType;
  severity: AlertSeverity;
  message: string;
  resolved: boolean;
}

export interface MetricPoint {
  timestamp: number;
  value: number;
}

export interface NetworkMetrics {
  rtt: number;
  throughput: number;
  activePeers: number;
  packetLoss: number;
  throughputHistory: MetricPoint[];
  rttHistory: MetricPoint[];
}

export interface SimulationEvent {
  id: string;
  timestamp: number;
  type: 'malicious_peer' | 'node_failure' | 'ddos';
  message: string;
  peerId?: string;
}
