'use client';
import { useRef, useState, DragEvent } from 'react';
import { useVirexStore } from '@/lib/store';
import type { Transfer } from '@/lib/types';

function formatBytes(bytes: number): string {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  if (bytes >= 1024)      return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

function formatSpeed(bps: number): string {
  if (bps >= 1024 ** 2) return `${(bps / 1024 ** 2).toFixed(1)} MB/s`;
  if (bps >= 1024)      return `${(bps / 1024).toFixed(0)} KB/s`;
  return `${bps.toFixed(0)} B/s`;
}

function eta(fileSize: number, progress: number, speed: number): string {
  if (speed <= 0 || progress >= 100) return '—';
  const remaining = fileSize * (1 - progress / 100);
  const secs = remaining / speed;
  if (secs >= 3600) return `${(secs / 3600).toFixed(1)}h`;
  if (secs >= 60)   return `${Math.ceil(secs / 60)}m`;
  return `${Math.ceil(secs)}s`;
}

function statusColor(status: string): string {
  return {
    active:   'var(--cyan)',
    complete: 'var(--green)',
    failed:   'var(--red)',
    paused:   'var(--amber)',
    pending:  'var(--text-muted)',
  }[status] ?? 'white';
}

export default function TransferPanel() {
  const transfers   = useVirexStore((s) => s.transfers);
  const addTransfer = useVirexStore((s) => s.addTransfer);
  const [dragging, setDragging]   = useState(false);
  const [filter, setFilter]       = useState<'all' | 'active' | 'complete'>('all');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const list = Object.values(transfers)
    .filter((t) => filter === 'all' || t.status === filter)
    .sort((a, b) => b.startTime - a.startTime);

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(false);
    Array.from(e.dataTransfer.files).forEach(simulateQueueFile);
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files) Array.from(e.target.files).forEach(simulateQueueFile);
  }

  function simulateQueueFile(file: File) {
    const uid = () => Math.random().toString(36).slice(2, 10);
    const totalChunks = Math.ceil(file.size / (256 * 1024)) || 4;
    const peers = useVirexStore.getState();
    const peerIds = Object.keys(peers.peers).filter((id) => !peers.peers[id].isOwn && peers.peers[id].status === 'trusted').slice(0, 3);
    addTransfer({
      id: 'tx_' + uid(),
      fileName: file.name,
      fileSize: file.size || 1024 * 1024,
      status: 'active',
      direction: 'upload',
      progress: 0,
      speed: 0,
      sourcePeers: peerIds,
      chunks: Array.from({ length: Math.min(totalChunks, 128) }, (_, i) => ({
        index: i,
        total: Math.min(totalChunks, 128),
        received: false,
        peerId: peerIds[i % peerIds.length] ?? 'peer_unknown',
      })),
      startTime: Date.now(),
      hash: 'sha256:' + Array.from({ length: 40 }, () =>
        '0123456789abcdef'[Math.floor(Math.random() * 16)]).join(''),
    });
  }

  return (
    <div className="virex-panel" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div className="virex-panel-header">
        <span className="virex-panel-title">Data Transfers</span>
        <div className="flex items-center gap-3">
          {(['all', 'active', 'complete'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                fontFamily: 'Rajdhani, sans-serif',
                fontWeight: 600,
                fontSize: '0.62rem',
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                padding: '2px 8px',
                borderRadius: 3,
                border: `1px solid ${filter === f ? 'var(--cyan)' : 'var(--border)'}`,
                background: filter === f ? 'rgba(0,212,255,0.08)' : 'transparent',
                color: filter === f ? 'var(--cyan)' : 'var(--text-muted)',
                cursor: 'pointer',
              }}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        style={{
          margin: '10px 12px 0',
          padding: '10px',
          borderRadius: 4,
          border: `1px dashed ${dragging ? 'var(--cyan)' : 'var(--border)'}`,
          background: dragging ? 'rgba(0,212,255,0.05)' : 'transparent',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 10,
          cursor: 'pointer',
          transition: 'all 0.2s',
          flexShrink: 0,
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--cyan)" strokeWidth="1.5" opacity={0.7}>
          <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
          <polyline points="17 8 12 3 7 8"/>
          <line x1="12" y1="3" x2="12" y2="15"/>
        </svg>
        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'Rajdhani, sans-serif', letterSpacing: '0.08em' }}>
          Drop files to send · Click to browse
        </span>
        <input ref={fileInputRef} type="file" multiple style={{ display: 'none' }} onChange={handleFileInput} />
      </div>

      {/* Transfer list */}
      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, padding: '6px 0' }}>
        {list.length === 0 && (
          <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
            No transfers
          </div>
        )}
        {list.map((tx) => (
          <TransferRow key={tx.id} transfer={tx} />
        ))}
      </div>
    </div>
  );
}

function TransferRow({ transfer: tx }: { transfer: Transfer }) {
  const color = statusColor(tx.status);

  return (
    <div
      style={{
        padding: '9px 12px',
        borderBottom: '1px solid rgba(26,45,71,0.5)',
        borderLeft: `2px solid ${color}`,
      }}
    >
      {/* Filename + status */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
          <DirectionIcon dir={tx.direction} />
          <span
            style={{
              fontSize: '0.78rem',
              color: 'var(--text-primary)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              maxWidth: 200,
            }}
          >
            {tx.fileName}
          </span>
        </div>
        <div className="flex items-center gap-3 ml-3" style={{ flexShrink: 0 }}>
          <span className="data" style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
            {formatBytes(tx.fileSize)}
          </span>
          <span
            style={{
              fontFamily: 'Rajdhani, sans-serif',
              fontWeight: 700,
              fontSize: '0.6rem',
              letterSpacing: '0.1em',
              color,
              textTransform: 'uppercase',
            }}
          >
            {tx.status}
          </span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="progress-bar" style={{ height: 3, marginBottom: 5 }}>
        <div className="progress-fill" style={{ width: `${tx.progress}%` }} />
      </div>

      {/* Stats row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="flex items-center gap-4">
          <span className="data" style={{ fontSize: '0.65rem', color: 'var(--cyan)' }}>
            {tx.progress.toFixed(1)}%
          </span>
          {tx.status === 'active' && (
            <>
              <span className="data" style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                ↓ {formatSpeed(tx.speed)}
              </span>
              <span className="data" style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                ETA {eta(tx.fileSize, tx.progress, tx.speed)}
              </span>
            </>
          )}
        </div>
        {/* Source peers */}
        <div className="flex items-center gap-1">
          {tx.sourcePeers.map((pid) => (
            <span
              key={pid}
              className="data"
              style={{
                fontSize: '0.58rem',
                padding: '1px 5px',
                borderRadius: 2,
                background: 'var(--bg-raised)',
                border: '1px solid var(--border)',
                color: 'var(--text-muted)',
              }}
            >
              {pid.replace('peer_', '').slice(0, 8)}
            </span>
          ))}
        </div>
      </div>

      {/* Chunk map */}
      {tx.chunks.length > 0 && tx.status === 'active' && (
        <div className="chunk-grid" style={{ marginTop: 6 }}>
          {tx.chunks.map((c) => (
            <div key={c.index} className={`chunk-cell${c.received ? ' received' : ''}`} />
          ))}
        </div>
      )}
    </div>
  );
}

function DirectionIcon({ dir }: { dir: 'upload' | 'download' }) {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={dir === 'download' ? 'var(--cyan)' : 'var(--amber)'} strokeWidth="2.5">
      {dir === 'download'
        ? <><path d="M12 4v12"/><path d="M8 12l4 4 4-4"/><path d="M4 20h16"/></>
        : <><path d="M12 20V8"/><path d="M8 12l4-4 4 4"/><path d="M4 4h16"/></>
      }
    </svg>
  );
}
