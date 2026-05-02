'use client';
import { useMockNetwork } from '@/lib/mock-network';
import TopBar       from '@/components/TopBar';
import PeerGraph    from '@/components/PeerGraph';
import MetricsPanel from '@/components/MetricsPanel';
import SecurityPanel from '@/components/SecurityPanel';
import TransferPanel from '@/components/TransferPanel';
import SimulationPanel from '@/components/SimulationPanel';

export default function Dashboard() {
  useMockNetwork();

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        overflow: 'hidden',
        background: 'var(--bg-base)',
      }}
    >
      <TopBar />

      {/* Main dashboard grid */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: 'grid',
          gridTemplateColumns: '1.6fr 1.4fr 1fr',
          gridTemplateRows: '1fr 1fr',
          gap: 8,
          padding: 8,
        }}
      >
        {/* PeerGraph — spans both rows on left */}
        <div style={{ gridColumn: '1', gridRow: '1 / 3' }}>
          <PeerGraph />
        </div>

        {/* MetricsPanel — top center */}
        <div style={{ gridColumn: '2', gridRow: '1' }}>
          <MetricsPanel />
        </div>

        {/* SecurityPanel — bottom center */}
        <div style={{ gridColumn: '2', gridRow: '2' }}>
          <SecurityPanel />
        </div>

        {/* TransferPanel — top right */}
        <div style={{ gridColumn: '3', gridRow: '1' }}>
          <TransferPanel />
        </div>

        {/* SimulationPanel — bottom right */}
        <div style={{ gridColumn: '3', gridRow: '2' }}>
          <SimulationPanel />
        </div>
      </div>
    </div>
  );
}
