'use client';
import { useState } from 'react';
import { useVirexStore } from '@/lib/store';
import type { Alert, Peer } from '@/lib/types';

type SortKey = 'trustScore' | 'latency' | 'bandwidth' | 'anomalyScore';

function relTime(ts: number): string {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 60)  return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

function severityColor(s: string) {
  return { critical: '#ef4444', high: '#f59e0b', medium: '#fb923c', low: 'var(--text-muted)' }[s] ?? 'white';
}

function alertTypeLabel(t: string): string {
  return {
    anomalous_traffic: 'ANOMALOUS TRAFFIC',
    integrity_failure: 'INTEGRITY FAILURE',
    high_failure_rate: 'HIGH FAIL RATE',
    reputation_drop:   'REPUTATION DROP',
    ddos_pattern:      'DDOS PATTERN',
    fake_peer:         'FAKE PEER',
    poisoned_chunk:    'POISONED CHUNK',
  }[t] ?? t.toUpperCase();
}

export default function SecurityPanel() {
  const peers     = useVirexStore((s) => s.peers);
  const alerts    = useVirexStore((s) => s.alerts);
  const blacklist = useVirexStore((s) => s.blacklistPeer);
  const resolve   = useVirexStore((s) => s.resolveAlert);
  const [sort, setSort] = useState<SortKey>('trustScore');
  const [asc,  setAsc]  = useState(true);
  const [tab,  setTab]  = useState<'peers' | 'alerts'>('peers');

  const sortedPeers = Object.values(peers)
    .filter((p) => !p.isOwn)
    .sort((a, b) => {
      const av = a[sort] as number;
      const bv = b[sort] as number;
      return asc ? av - bv : bv - av;
    });

  const activeAlerts = alerts.filter((a) => !a.resolved);
  const resolvedAlerts = alerts.filter((a) => a.resolved).slice(0, 20);

  function toggleSort(key: SortKey) {
    if (sort === key) setAsc(!asc);
    else { setSort(key); setAsc(key === 'trustScore' || key === 'bandwidth' ? false : true); }
  }

  return (
    <div className="virex-panel" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div className="virex-panel-header">
        <span className="virex-panel-title">Security Monitor</span>
        <div className="flex gap-2">
          <TabBtn active={tab === 'peers'}  onClick={() => setTab('peers')}  label="Peers" count={sortedPeers.length} />
          <TabBtn active={tab === 'alerts'} onClick={() => setTab('alerts')} label="Alerts" count={activeAlerts.length} danger={activeAlerts.length > 0} />
        </div>
      </div>

      {tab === 'peers' && (
        <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
          <table className="virex-table">
            <thead style={{ position: 'sticky', top: 0, background: 'var(--bg-surface)', zIndex: 1 }}>
              <tr>
                <th>Peer ID</th>
                <SortableTh label="Trust" k="trustScore" sort={sort} asc={asc} onSort={toggleSort} />
                <SortableTh label="Latency" k="latency" sort={sort} asc={asc} onSort={toggleSort} />
                <SortableTh label="BW" k="bandwidth" sort={sort} asc={asc} onSort={toggleSort} />
                <SortableTh label="Anomaly" k="anomalyScore" sort={sort} asc={asc} onSort={toggleSort} />
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {sortedPeers.map((peer) => (
                <PeerRow key={peer.id} peer={peer} onBlacklist={blacklist} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'alerts' && (
        <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
          {activeAlerts.length === 0 && resolvedAlerts.length === 0 && (
            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
              No alerts detected
            </div>
          )}
          {activeAlerts.length > 0 && (
            <div>
              <div style={{ padding: '8px 12px 4px', fontSize: '0.6rem', color: 'var(--text-muted)', letterSpacing: '0.1em', fontFamily: 'Rajdhani, sans-serif', textTransform: 'uppercase' }}>
                Active ({activeAlerts.length})
              </div>
              {activeAlerts.map((a) => (
                <AlertRow key={a.id} alert={a} onResolve={resolve} />
              ))}
            </div>
          )}
          {resolvedAlerts.length > 0 && (
            <div>
              <div style={{ padding: '8px 12px 4px', fontSize: '0.6rem', color: 'var(--text-muted)', letterSpacing: '0.1em', fontFamily: 'Rajdhani, sans-serif', textTransform: 'uppercase' }}>
                Resolved
              </div>
              {resolvedAlerts.map((a) => (
                <AlertRow key={a.id} alert={a} onResolve={resolve} resolved />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TabBtn({
  active, onClick, label, count, danger,
}: {
  active: boolean; onClick: () => void; label: string; count: number; danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        fontFamily: 'Rajdhani, sans-serif',
        fontWeight: 600,
        fontSize: '0.65rem',
        letterSpacing: '0.1em',
        textTransform: 'uppercase',
        padding: '3px 10px',
        borderRadius: 3,
        border: `1px solid ${active ? (danger && count > 0 ? '#ef4444' : 'var(--cyan)') : 'var(--border)'}`,
        background: active ? (danger && count > 0 ? 'rgba(239,68,68,0.1)' : 'rgba(0,212,255,0.08)') : 'transparent',
        color: active ? (danger && count > 0 ? '#ef4444' : 'var(--cyan)') : 'var(--text-muted)',
        cursor: 'pointer',
      }}
    >
      {label} {count > 0 && <span>({count})</span>}
    </button>
  );
}

function SortableTh({
  label, k, sort, asc, onSort,
}: {
  label: string; k: SortKey; sort: SortKey; asc: boolean; onSort: (k: SortKey) => void;
}) {
  const active = sort === k;
  return (
    <th
      onClick={() => onSort(k)}
      style={{ cursor: 'pointer', color: active ? 'var(--cyan)' : undefined, userSelect: 'none' }}
    >
      {label} {active ? (asc ? '↑' : '↓') : ''}
    </th>
  );
}

function PeerRow({ peer, onBlacklist }: { peer: Peer; onBlacklist: (id: string) => void }) {
  const trustColor = peer.status === 'blacklisted' ? '#ef4444'
    : peer.trustScore >= 70 ? '#22c55e'
    : peer.trustScore >= 40 ? '#f59e0b'
    : '#ef4444';

  const anomalyColor = peer.anomalyScore > 0.7 ? '#ef4444'
    : peer.anomalyScore > 0.4 ? '#f59e0b'
    : 'var(--text-muted)';

  return (
    <tr>
      <td>
        <span className="data" style={{ color: 'var(--text-primary)', fontSize: '0.7rem' }}>
          {peer.shortId}
        </span>
      </td>
      <td>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 36, height: 3, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{ width: `${peer.trustScore}%`, height: '100%', background: trustColor, borderRadius: 2 }} />
          </div>
          <span className="data" style={{ color: trustColor, fontSize: '0.7rem' }}>
            {peer.trustScore.toFixed(0)}
          </span>
        </div>
      </td>
      <td className="data" style={{ color: peer.latency > 100 ? 'var(--amber)' : 'var(--text-secondary)', fontSize: '0.7rem' }}>
        {peer.latency.toFixed(0)}ms
      </td>
      <td className="data" style={{ fontSize: '0.7rem' }}>
        {peer.bandwidth.toFixed(1)}
      </td>
      <td className="data" style={{ color: anomalyColor, fontSize: '0.7rem' }}>
        {peer.anomalyScore.toFixed(3)}
      </td>
      <td>
        <span className={`virex-badge status-${peer.status}`} style={{ fontSize: '0.6rem' }}>
          {peer.status.toUpperCase()}
        </span>
      </td>
      <td>
        {peer.status !== 'blacklisted' && (
          <button
            onClick={() => onBlacklist(peer.id)}
            style={{
              fontFamily: '"JetBrains Mono", monospace',
              fontSize: '0.6rem',
              padding: '2px 6px',
              background: 'transparent',
              border: '1px solid rgba(239,68,68,0.3)',
              color: '#ef4444',
              borderRadius: 2,
              cursor: 'pointer',
              opacity: 0.7,
            }}
            title="Blacklist peer"
          >
            BAN
          </button>
        )}
      </td>
    </tr>
  );
}

function AlertRow({
  alert, onResolve, resolved,
}: {
  alert: Alert; onResolve: (id: string) => void; resolved?: boolean;
}) {
  const color = severityColor(alert.severity);
  const isCritical = alert.severity === 'critical' && !resolved;

  return (
    <div
      style={{
        padding: '8px 12px',
        borderBottom: '1px solid rgba(26,45,71,0.5)',
        borderLeft: `3px solid ${resolved ? 'var(--border)' : color}`,
        opacity: resolved ? 0.5 : 1,
        ...(isCritical ? { animation: 'alert-blink 1.5s ease-in-out infinite' } : {}),
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
            <span
              style={{
                fontFamily: 'Rajdhani, sans-serif',
                fontWeight: 700,
                fontSize: '0.6rem',
                letterSpacing: '0.1em',
                color,
              }}
            >
              {alert.severity.toUpperCase()}
            </span>
            <span
              style={{
                fontFamily: 'Rajdhani, sans-serif',
                fontWeight: 600,
                fontSize: '0.6rem',
                letterSpacing: '0.08em',
                color: 'var(--text-muted)',
              }}
            >
              {alertTypeLabel(alert.type)}
            </span>
            <span className="data" style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>
              {relTime(alert.timestamp)}
            </span>
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginBottom: 2 }}>
            {alert.message}
          </div>
          <div className="data" style={{ fontSize: '0.62rem', color: 'var(--text-muted)' }}>
            Peer: {alert.peerId.replace('peer_', '')}
          </div>
        </div>
        {!resolved && (
          <button
            onClick={() => onResolve(alert.id)}
            style={{
              fontFamily: '"JetBrains Mono", monospace',
              fontSize: '0.6rem',
              padding: '2px 6px',
              background: 'transparent',
              border: '1px solid var(--border-bright)',
              color: 'var(--text-muted)',
              borderRadius: 2,
              cursor: 'pointer',
              flexShrink: 0,
              marginLeft: 8,
            }}
          >
            ACK
          </button>
        )}
      </div>
    </div>
  );
}
