'use client';
import { useState } from 'react';
import { useVirexStore } from '@/lib/store';
import type { SimulationEvent } from '@/lib/types';

function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

function relTime(ts: number): string {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 60)  return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

const SIM_COLORS: Record<SimulationEvent['type'], string> = {
  malicious_peer: '#ef4444',
  node_failure:   '#f59e0b',
  ddos:           '#a855f7',
};

const SIM_LABELS: Record<SimulationEvent['type'], string> = {
  malicious_peer: 'MALICIOUS PEER',
  node_failure:   'NODE FAILURE',
  ddos:           'DDOS SIM',
};

export default function SimulationPanel() {
  const addPeer       = useVirexStore((s) => s.addPeer);
  const removePeer    = useVirexStore((s) => s.removePeer);
  const addAlert      = useVirexStore((s) => s.addAlert);
  const addSimEvent   = useVirexStore((s) => s.addSimulationEvent);
  const simLog        = useVirexStore((s) => s.simulationLog);
  const blacklist     = useVirexStore((s) => s.blacklistPeer);
  const updateMetrics = useVirexStore((s) => s.updateMetrics);

  const [running, setRunning] = useState<SimulationEvent['type'] | null>(null);

  function simulateMaliciousPeer() {
    if (running) return;
    setRunning('malicious_peer');
    const id = 'peer_FAKE' + uid().toUpperCase();
    const shortId = id.replace('peer_', '').slice(0, 8);

    addPeer({
      id,
      shortId,
      status: 'flagged',
      trustScore: 12.4,
      latency: 340,
      bandwidth: 3.2,
      packetLoss: 12.7,
      uptime: 60,
      successRate: 21.3,
      anomalyScore: 0.97,
      connectedPeers: ['peer_i9j0k1l2'],
      lastSeen: Date.now(),
      publicKey: 'ed25519:FORGED...',
    });

    addAlert({
      timestamp: Date.now(),
      peerId: id,
      type: 'fake_peer',
      severity: 'critical',
      message: `Forged ECDSA signature detected — Sybil peer ${shortId} injected`,
      resolved: false,
    });

    addSimEvent({
      timestamp: Date.now(),
      type: 'malicious_peer',
      message: `Injected malicious peer ${shortId} with anomaly score 0.97`,
      peerId: id,
    });

    setTimeout(() => {
      addAlert({
        timestamp: Date.now(),
        peerId: id,
        type: 'poisoned_chunk',
        severity: 'high',
        message: `${shortId} attempted to serve corrupted chunk 0/32 — rejected`,
        resolved: false,
      });
    }, 3000);

    setTimeout(() => {
      blacklist(id);
      addSimEvent({
        timestamp: Date.now(),
        type: 'malicious_peer',
        message: `Peer ${shortId} automatically blacklisted after trust score < 10`,
        peerId: id,
      });
      setRunning(null);
    }, 6000);
  }

  function simulateNodeFailure() {
    if (running) return;
    setRunning('node_failure');

    const s = useVirexStore.getState();
    const eligible = Object.values(s.peers).filter(
      (p) => !p.isOwn && p.status === 'trusted'
    );
    if (eligible.length === 0) { setRunning(null); return; }

    const victim = eligible[Math.floor(Math.random() * eligible.length)];
    addSimEvent({
      timestamp: Date.now(),
      type: 'node_failure',
      message: `Simulating abrupt failure of peer ${victim.shortId}`,
      peerId: victim.id,
    });

    addAlert({
      timestamp: Date.now(),
      peerId: victim.id,
      type: 'high_failure_rate',
      severity: 'medium',
      message: `Peer ${victim.shortId} became unreachable — rerouting ${victim.connectedPeers.length} connections`,
      resolved: false,
    });

    setTimeout(() => {
      removePeer(victim.id);
      addSimEvent({
        timestamp: Date.now(),
        type: 'node_failure',
        message: `Peer ${victim.shortId} removed from topology — recovery complete`,
        peerId: victim.id,
      });
      setRunning(null);
    }, 4000);
  }

  function simulateDDoS() {
    if (running) return;
    setRunning('ddos');

    addSimEvent({
      timestamp: Date.now(),
      type: 'ddos',
      message: 'DDoS simulation started — flooding network with 50k req/s',
    });

    addAlert({
      timestamp: Date.now(),
      peerId: 'peer_q7r8s9t0',
      type: 'ddos_pattern',
      severity: 'critical',
      message: 'DDoS-like flood: 50,412 req/s from peer cluster — congestion control engaged',
      resolved: false,
    });

    updateMetrics({
      packetLoss: 8.4 + Math.random() * 2,
      rtt: 180 + Math.random() * 40,
    });

    addSimEvent({
      timestamp: Date.now() + 2000,
      type: 'ddos',
      message: 'Rate limiting applied — dropping requests above 100/min per peer',
    });

    setTimeout(() => {
      updateMetrics({ packetLoss: 0.4, rtt: 28 });
      addSimEvent({
        timestamp: Date.now(),
        type: 'ddos',
        message: 'DDoS mitigation complete — network metrics restored',
      });
      setRunning(null);
    }, 8000);
  }

  const buttons: Array<{
    type: SimulationEvent['type'];
    label: string;
    desc: string;
    action: () => void;
  }> = [
    {
      type: 'malicious_peer',
      label: 'Inject Malicious Peer',
      desc: 'Adds a Sybil peer, triggers detection & auto-blacklist',
      action: simulateMaliciousPeer,
    },
    {
      type: 'node_failure',
      label: 'Node Failure',
      desc: 'Abruptly removes a trusted peer, tests rerouting',
      action: simulateNodeFailure,
    },
    {
      type: 'ddos',
      label: 'DDoS Simulation',
      desc: 'Floods network, engages rate limiting & congestion control',
      action: simulateDDoS,
    },
  ];

  return (
    <div className="virex-panel" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div className="virex-panel-header">
        <span className="virex-panel-title">Simulation Engine</span>
        {running && (
          <div className="flex items-center gap-2">
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: SIM_COLORS[running], display: 'inline-block', animation: 'pulse 1s infinite' }} />
            <span style={{ fontFamily: 'Rajdhani, sans-serif', fontWeight: 600, fontSize: '0.62rem', letterSpacing: '0.1em', color: SIM_COLORS[running] }}>
              RUNNING
            </span>
          </div>
        )}
      </div>

      <div style={{ padding: '10px 12px', flexShrink: 0 }}>
        {buttons.map((btn) => (
          <div key={btn.type} style={{ marginBottom: 8 }}>
            <button
              className="btn-sim"
              onClick={btn.action}
              disabled={!!running}
              style={{
                borderColor: running === btn.type ? SIM_COLORS[btn.type] : 'var(--border-bright)',
                color: running === btn.type ? SIM_COLORS[btn.type] : 'var(--text-secondary)',
                opacity: running && running !== btn.type ? 0.4 : 1,
                background: running === btn.type ? `${SIM_COLORS[btn.type]}12` : 'transparent',
                cursor: running ? 'not-allowed' : 'pointer',
              }}
            >
              {btn.label}
            </button>
            <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)', marginTop: 3, paddingLeft: 2 }}>
              {btn.desc}
            </div>
          </div>
        ))}
      </div>

      {/* Simulation log */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        minHeight: 0,
        borderTop: '1px solid var(--border)',
        marginTop: 4,
      }}>
        <div style={{ padding: '8px 12px 4px', fontSize: '0.6rem', color: 'var(--text-muted)', fontFamily: 'Rajdhani, sans-serif', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
          Event Log
        </div>
        {simLog.length === 0 && (
          <div style={{ padding: '12px', textAlign: 'center', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
            No simulation events yet
          </div>
        )}
        {simLog.map((ev) => (
          <div
            key={ev.id}
            style={{
              padding: '6px 12px',
              borderBottom: '1px solid rgba(26,45,71,0.3)',
              borderLeft: `2px solid ${SIM_COLORS[ev.type]}`,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
              <span
                style={{
                  fontFamily: 'Rajdhani, sans-serif',
                  fontWeight: 700,
                  fontSize: '0.58rem',
                  letterSpacing: '0.1em',
                  color: SIM_COLORS[ev.type],
                }}
              >
                {SIM_LABELS[ev.type]}
              </span>
              <span className="data" style={{ fontSize: '0.58rem', color: 'var(--text-muted)' }}>
                {relTime(ev.timestamp)}
              </span>
            </div>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)' }}>
              {ev.message}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
