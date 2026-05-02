'use client';
import { useVirexStore } from '@/lib/store';

export default function TopBar() {
  const ownPeerId    = useVirexStore((s) => s.ownPeerId);
  const connState    = useVirexStore((s) => s.connectionState);
  const metrics      = useVirexStore((s) => s.metrics);
  const alertCount   = useVirexStore((s) => s.alerts.filter((a) => !a.resolved).length);

  const stateColor: Record<string, string> = {
    connected:    'var(--green)',
    connecting:   'var(--amber)',
    disconnected: 'var(--red)',
  };

  return (
    <header
      className="flex items-center justify-between px-5 py-2.5"
      style={{
        background: 'var(--bg-surface)',
        borderBottom: '1px solid var(--border)',
        flexShrink: 0,
      }}
    >
      {/* Logo */}
      <div className="flex items-center gap-3">
        <div
          className="flex items-center justify-center w-8 h-8 rounded"
          style={{
            background: 'rgba(0,212,255,0.08)',
            border: '1px solid rgba(0,212,255,0.3)',
          }}
        >
          <svg viewBox="0 0 20 20" width="16" height="16" fill="none">
            <circle cx="10" cy="10" r="2" fill="var(--cyan)" />
            <circle cx="3"  cy="4"  r="1.5" fill="var(--cyan)" opacity="0.6" />
            <circle cx="17" cy="4"  r="1.5" fill="var(--cyan)" opacity="0.6" />
            <circle cx="3"  cy="16" r="1.5" fill="var(--cyan)" opacity="0.6" />
            <circle cx="17" cy="16" r="1.5" fill="var(--cyan)" opacity="0.6" />
            <line x1="10" y1="8"  x2="3"  y2="5.5"  stroke="var(--cyan)" strokeWidth="0.8" opacity="0.5" />
            <line x1="10" y1="8"  x2="17" y2="5.5"  stroke="var(--cyan)" strokeWidth="0.8" opacity="0.5" />
            <line x1="10" y1="12" x2="3"  y2="14.5" stroke="var(--cyan)" strokeWidth="0.8" opacity="0.5" />
            <line x1="10" y1="12" x2="17" y2="14.5" stroke="var(--cyan)" strokeWidth="0.8" opacity="0.5" />
          </svg>
        </div>
        <div>
          <div
            className="text-glow"
            style={{
              fontFamily: 'Rajdhani, sans-serif',
              fontWeight: 700,
              fontSize: '1.2rem',
              letterSpacing: '0.2em',
              color: 'var(--cyan)',
              lineHeight: 1,
            }}
          >
            VIREX
          </div>
          <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', letterSpacing: '0.25em' }}>
            ISPDN · v1.0.0
          </div>
        </div>
      </div>

      {/* Center stats */}
      <div className="flex items-center gap-6">
        <Stat label="RTT" value={`${metrics.rtt.toFixed(0)} ms`} />
        <Stat label="Throughput" value={`${metrics.throughput.toFixed(1)} Mbps`} />
        <Stat label="Packet Loss" value={`${metrics.packetLoss.toFixed(2)}%`} />
        <Stat label="Active Peers" value={String(metrics.activePeers)} />
      </div>

      {/* Right: alerts + status + peer ID */}
      <div className="flex items-center gap-4">
        {alertCount > 0 && (
          <div
            className="flex items-center gap-2 px-3 py-1 rounded"
            style={{
              background: 'rgba(239,68,68,0.1)',
              border: '1px solid rgba(239,68,68,0.4)',
            }}
          >
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--red)', display: 'inline-block' }} />
            <span className="data" style={{ color: 'var(--red)', fontSize: '0.7rem' }}>
              {alertCount} ALERT{alertCount !== 1 ? 'S' : ''}
            </span>
          </div>
        )}

        <div className="flex items-center gap-2">
          <span
            className="inline-block w-2 h-2 rounded-full"
            style={{
              background: stateColor[connState],
              boxShadow: `0 0 6px ${stateColor[connState]}`,
              animation: connState === 'connected' ? 'pulse 2s infinite' : undefined,
            }}
          />
          <span
            style={{
              fontFamily: 'Rajdhani, sans-serif',
              fontWeight: 600,
              fontSize: '0.7rem',
              letterSpacing: '0.12em',
              color: stateColor[connState],
              textTransform: 'uppercase',
            }}
          >
            {connState}
          </span>
        </div>

        <div
          className="flex items-center gap-2 px-3 py-1 rounded"
          style={{
            background: 'var(--bg-raised)',
            border: '1px solid var(--border)',
          }}
        >
          <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)', letterSpacing: '0.12em' }}>
            OWN ID
          </span>
          <span className="data" style={{ color: 'var(--cyan)', opacity: 0.8, fontSize: '0.7rem' }}>
            {ownPeerId.slice(0, 18)}…
          </span>
        </div>
      </div>
    </header>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-center">
      <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
        {label}
      </div>
      <div className="data" style={{ color: 'var(--text-primary)', fontSize: '0.8rem', marginTop: 1 }}>
        {value}
      </div>
    </div>
  );
}
