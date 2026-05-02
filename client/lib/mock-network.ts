'use client';
import { useEffect } from 'react';
import { useVirexStore } from './store';
import type { Peer, AlertType, AlertSeverity } from './types';

function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

function jitter(base: number, pct: number): number {
  return base + (Math.random() - 0.5) * 2 * base * pct;
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

const SEED_PEERS: Omit<Peer, 'connectedPeers'>[] = [
  {
    id: 'peer_a1b2c3d4', shortId: 'a1b2c3d4', status: 'trusted',
    trustScore: 94.3, latency: 12, bandwidth: 145.2, packetLoss: 0.1,
    uptime: 172800, successRate: 99.2, anomalyScore: 0.02,
    lastSeen: Date.now(), publicKey: 'ed25519:3Qa8xP1...Lmn7R',
  },
  {
    id: 'peer_e5f6g7h8', shortId: 'e5f6g7h8', status: 'trusted',
    trustScore: 81.7, latency: 23, bandwidth: 87.6, packetLoss: 0.3,
    uptime: 86400, successRate: 97.1, anomalyScore: 0.05,
    lastSeen: Date.now(), publicKey: 'ed25519:7Bk2yN4...Xyz9W',
  },
  {
    id: 'peer_i9j0k1l2', shortId: 'i9j0k1l2', status: 'flagged',
    trustScore: 67.2, latency: 45, bandwidth: 54.3, packetLoss: 1.2,
    uptime: 43200, successRate: 89.4, anomalyScore: 0.28,
    lastSeen: Date.now(), publicKey: 'ed25519:5Vc9sQ6...Abc3T',
  },
  {
    id: 'peer_m3n4o5p6', shortId: 'm3n4o5p6', status: 'trusted',
    trustScore: 91.8, latency: 8, bandwidth: 201.4, packetLoss: 0.05,
    uptime: 259200, successRate: 99.8, anomalyScore: 0.01,
    lastSeen: Date.now(), publicKey: 'ed25519:9Hp4rK2...Def6U',
  },
  {
    id: 'peer_q7r8s9t0', shortId: 'q7r8s9t0', status: 'flagged',
    trustScore: 31.4, latency: 156, bandwidth: 12.1, packetLoss: 4.7,
    uptime: 7200, successRate: 62.3, anomalyScore: 0.71,
    lastSeen: Date.now(), publicKey: 'ed25519:2Wj7mL5...Ghi8V',
  },
  {
    id: 'peer_u1v2w3x4', shortId: 'u1v2w3x4', status: 'trusted',
    trustScore: 71.9, latency: 67, bandwidth: 43.7, packetLoss: 0.8,
    uptime: 129600, successRate: 94.7, anomalyScore: 0.12,
    lastSeen: Date.now(), publicKey: 'ed25519:4Rn8tJ3...Jkl1X',
  },
  {
    id: 'peer_y5z6a7b8', shortId: 'y5z6a7b8', status: 'blacklisted',
    trustScore: 0, latency: 89, bandwidth: 28.9, packetLoss: 8.3,
    uptime: 3600, successRate: 31.7, anomalyScore: 0.94,
    lastSeen: Date.now(), publicKey: 'ed25519:6Fb5uM1...Mno4Y',
  },
  {
    id: 'peer_c9d0e1f2', shortId: 'c9d0e1f2', status: 'trusted',
    trustScore: 88.6, latency: 18, bandwidth: 178.3, packetLoss: 0.2,
    uptime: 216000, successRate: 98.4, anomalyScore: 0.03,
    lastSeen: Date.now(), publicKey: 'ed25519:8Lp6vN9...Pqr2Z',
  },
  {
    id: 'peer_g3h4i5j6', shortId: 'g3h4i5j6', status: 'trusted',
    trustScore: 76.4, latency: 34, bandwidth: 92.1, packetLoss: 0.6,
    uptime: 108000, successRate: 96.2, anomalyScore: 0.08,
    lastSeen: Date.now(), publicKey: 'ed25519:1Gq3wO7...Stu5A',
  },
  {
    id: 'peer_k7l8m9n0', shortId: 'k7l8m9n0', status: 'flagged',
    trustScore: 42.3, latency: 201, bandwidth: 8.4, packetLoss: 3.1,
    uptime: 14400, successRate: 74.8, anomalyScore: 0.55,
    lastSeen: Date.now(), publicKey: 'ed25519:0Hs1xP8...Vwx6B',
  },
];

const TOPOLOGY: Record<string, string[]> = {
  peer_a1b2c3d4: ['peer_m3n4o5p6', 'peer_c9d0e1f2', 'peer_e5f6g7h8'],
  peer_e5f6g7h8: ['peer_a1b2c3d4', 'peer_u1v2w3x4', 'peer_g3h4i5j6'],
  peer_i9j0k1l2: ['peer_q7r8s9t0', 'peer_k7l8m9n0'],
  peer_m3n4o5p6: ['peer_a1b2c3d4', 'peer_c9d0e1f2', 'peer_g3h4i5j6'],
  peer_q7r8s9t0: ['peer_i9j0k1l2', 'peer_y5z6a7b8'],
  peer_u1v2w3x4: ['peer_e5f6g7h8', 'peer_g3h4i5j6'],
  peer_y5z6a7b8: ['peer_q7r8s9t0'],
  peer_c9d0e1f2: ['peer_a1b2c3d4', 'peer_m3n4o5p6', 'peer_g3h4i5j6'],
  peer_g3h4i5j6: ['peer_e5f6g7h8', 'peer_m3n4o5p6', 'peer_c9d0e1f2', 'peer_u1v2w3x4'],
  peer_k7l8m9n0: ['peer_i9j0k1l2'],
};

const ALERT_MESSAGES: Record<AlertType, (peerId: string) => string> = {
  anomalous_traffic: () =>
    `Request spike: ${Math.floor(200 + Math.random() * 800)}/min (threshold: 100/min)`,
  integrity_failure: () =>
    `SHA-256 mismatch on chunk ${Math.floor(Math.random() * 128)}/128`,
  high_failure_rate: () =>
    `Transfer failure rate ${(10 + Math.random() * 30).toFixed(1)}% (baseline: 5%)`,
  reputation_drop: () =>
    `Trust score dropped −${(5 + Math.random() * 20).toFixed(1)} pts in 10m`,
  ddos_pattern: () =>
    'DDoS-like flood pattern detected from peer cluster',
  fake_peer: () =>
    'Forged ECDSA signature — likely Sybil peer',
  poisoned_chunk: () =>
    `Data poisoning: modified chunk rejected at index ${Math.floor(Math.random() * 128)}`,
};

export function useMockNetwork() {
  const store = useVirexStore.getState;

  // Initialize on mount
  useEffect(() => {
    const s = useVirexStore.getState();

    SEED_PEERS.forEach((p) => {
      s.addPeer({ ...p, connectedPeers: TOPOLOGY[p.id] ?? [] });
    });

    s.addPeer({
      id: s.ownPeerId,
      shortId: s.ownPeerId.replace('peer_', '').slice(0, 8),
      status: 'trusted',
      trustScore: 100,
      latency: 0,
      bandwidth: 1000,
      packetLoss: 0,
      uptime: 3600,
      successRate: 100,
      anomalyScore: 0,
      connectedPeers: ['peer_a1b2c3d4', 'peer_m3n4o5p6', 'peer_e5f6g7h8'],
      lastSeen: Date.now(),
      isOwn: true,
    });

    // Seed alerts
    s.addAlert({
      timestamp: Date.now() - 45_000,
      peerId: 'peer_y5z6a7b8',
      type: 'poisoned_chunk',
      severity: 'critical',
      message: 'SHA-256 hash mismatch on chunk 47/128 — data poisoning detected',
      resolved: false,
    });
    s.addAlert({
      timestamp: Date.now() - 120_000,
      peerId: 'peer_q7r8s9t0',
      type: 'anomalous_traffic',
      severity: 'high',
      message: 'Request frequency 847/min exceeds threshold (100/min)',
      resolved: false,
    });
    s.addAlert({
      timestamp: Date.now() - 300_000,
      peerId: 'peer_i9j0k1l2',
      type: 'reputation_drop',
      severity: 'medium',
      message: 'Trust score dropped 18.4 pts in 10m — under review',
      resolved: true,
    });
    s.addAlert({
      timestamp: Date.now() - 600_000,
      peerId: 'peer_k7l8m9n0',
      type: 'high_failure_rate',
      severity: 'low',
      message: 'Transfer failure rate 25.2% exceeds baseline (5%)',
      resolved: true,
    });

    // Seed transfers
    const seedTransfers = [
      {
        fileName: 'dataset_v3.tar.gz',
        fileSize: 2.4 * 1024 ** 3,
        sourcePeers: ['peer_a1b2c3d4', 'peer_m3n4o5p6', 'peer_c9d0e1f2'],
        progress: 72,
        speed: 45.6 * 1024 ** 2,
        elapsed: 120_000,
      },
      {
        fileName: 'model_weights_epoch42.pt',
        fileSize: 847 * 1024 ** 2,
        sourcePeers: ['peer_e5f6g7h8', 'peer_g3h4i5j6'],
        progress: 45,
        speed: 23.1 * 1024 ** 2,
        elapsed: 60_000,
      },
      {
        fileName: 'backup_snapshot_2026-05-02.tar',
        fileSize: 512 * 1024 ** 2,
        sourcePeers: ['peer_m3n4o5p6'],
        progress: 18,
        speed: 12.8 * 1024 ** 2,
        elapsed: 30_000,
      },
    ];

    seedTransfers.forEach((t) => {
      const totalChunks = 128;
      const receivedCount = Math.floor(totalChunks * t.progress / 100);
      s.addTransfer({
        id: 'tx_' + uid(),
        fileName: t.fileName,
        fileSize: t.fileSize,
        status: 'active',
        direction: 'download',
        progress: t.progress,
        speed: t.speed,
        sourcePeers: t.sourcePeers,
        chunks: Array.from({ length: totalChunks }, (_, i) => ({
          index: i,
          total: totalChunks,
          received: i < receivedCount,
          peerId: t.sourcePeers[i % t.sourcePeers.length],
        })),
        startTime: Date.now() - t.elapsed,
        hash: 'sha256:' + Array.from({ length: 40 }, () =>
          '0123456789abcdef'[Math.floor(Math.random() * 16)]).join(''),
      });
    });

    // Seed metric history
    const now = Date.now();
    s.updateMetrics({
      rtt: 24,
      throughput: 156.3,
      activePeers: 10,
      packetLoss: 0.3,
      throughputHistory: Array.from({ length: 60 }, (_, i) => ({
        timestamp: now - (59 - i) * 1000,
        value: clamp(120 + Math.sin(i * 0.3) * 40 + Math.random() * 30, 20, 400),
      })),
      rttHistory: Array.from({ length: 60 }, (_, i) => ({
        timestamp: now - (59 - i) * 1000,
        value: clamp(18 + Math.sin(i * 0.2) * 10 + Math.random() * 8, 5, 200),
      })),
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Metric updates every second
  useEffect(() => {
    const id = setInterval(() => {
      const s = useVirexStore.getState();
      const now = Date.now();
      const tp = clamp(s.metrics.throughput + (Math.random() - 0.47) * 18, 10, 450);
      const rtt = clamp(s.metrics.rtt + (Math.random() - 0.5) * 5, 3, 250);
      const pl = clamp(s.metrics.packetLoss + (Math.random() - 0.5) * 0.15, 0, 12);
      const active = Object.values(s.peers).filter(
        (p) => !p.isOwn && p.status !== 'blacklisted'
      ).length;
      s.updateMetrics({ throughput: tp, rtt, packetLoss: pl, activePeers: active });
      s.pushMetricPoint('throughputHistory', { timestamp: now, value: tp });
      s.pushMetricPoint('rttHistory', { timestamp: now, value: rtt });
    }, 1000);
    return () => clearInterval(id);
  }, []);

  // Peer stat drift every 2 seconds
  useEffect(() => {
    const id = setInterval(() => {
      const s = useVirexStore.getState();
      Object.values(s.peers).forEach((peer) => {
        if (peer.isOwn || peer.status === 'blacklisted') return;
        s.updatePeer(peer.id, {
          latency: clamp(jitter(peer.latency, 0.08), 1, 300),
          bandwidth: clamp(jitter(peer.bandwidth, 0.05), 0.5, 500),
          packetLoss: clamp(peer.packetLoss + (Math.random() - 0.5) * 0.3, 0, 15),
          lastSeen: Date.now(),
        });
      });
    }, 2000);
    return () => clearInterval(id);
  }, []);

  // Transfer progress every 500 ms
  useEffect(() => {
    const id = setInterval(() => {
      const s = useVirexStore.getState();
      Object.values(s.transfers).forEach((tx) => {
        if (tx.status !== 'active') return;
        const newProg = Math.min(tx.progress + Math.random() * 1.5, 100);
        const receivedCount = Math.floor(tx.chunks.length * newProg / 100);
        s.updateTransfer(tx.id, {
          progress: newProg,
          chunks: tx.chunks.map((c, i) =>
            i < receivedCount ? { ...c, received: true } : c
          ),
          speed: clamp(
            tx.speed + (Math.random() - 0.5) * 5 * 1024 ** 2,
            256 * 1024,
            120 * 1024 ** 2
          ),
          status: newProg >= 100 ? 'complete' : 'active',
          ...(newProg >= 100 ? { endTime: Date.now() } : {}),
        });
      });
    }, 500);
    return () => clearInterval(id);
  }, []);

  // Random alerts every 20–40 seconds
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      timer = setTimeout(() => {
        const s = useVirexStore.getState();
        const peerIds = Object.keys(s.peers).filter((id) => !s.peers[id].isOwn);
        if (peerIds.length > 0) {
          const peerId = peerIds[Math.floor(Math.random() * peerIds.length)];
          const types: AlertType[] = [
            'anomalous_traffic', 'integrity_failure', 'high_failure_rate', 'reputation_drop',
          ];
          const type = types[Math.floor(Math.random() * types.length)];
          const severities: AlertSeverity[] = ['low', 'medium', 'high'];
          const severity = severities[Math.floor(Math.random() * severities.length)];
          s.addAlert({
            timestamp: Date.now(),
            peerId,
            type,
            severity,
            message: ALERT_MESSAGES[type](peerId),
            resolved: false,
          });
        }
        schedule();
      }, 20_000 + Math.random() * 20_000);
    };
    schedule();
    return () => clearTimeout(timer);
  }, []);

  return store;
}

function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}
