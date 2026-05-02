'use client';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { useVirexStore } from '@/lib/store';
import type { MetricPoint } from '@/lib/types';

function formatTime(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
}

interface StatCardProps {
  label: string;
  value: string;
  sub?: string;
  color?: string;
  blink?: boolean;
}

function StatCard({ label, value, sub, color = 'var(--cyan)', blink }: StatCardProps) {
  return (
    <div
      className="flex flex-col justify-between rounded p-3"
      style={{
        background: 'var(--bg-raised)',
        border: `1px solid var(--border)`,
        flex: 1,
      }}
    >
      <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', letterSpacing: '0.12em', fontFamily: 'Rajdhani, sans-serif', fontWeight: 600, textTransform: 'uppercase' }}>
        {label}
      </div>
      <div>
        <div
          className="data"
          style={{
            fontSize: '1.45rem',
            fontWeight: 500,
            color,
            lineHeight: 1,
            ...(blink ? { animation: 'alert-blink 1.5s ease-in-out infinite' } : {}),
          }}
        >
          {value}
        </div>
        {sub && (
          <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: 2 }}>
            {sub}
          </div>
        )}
      </div>
    </div>
  );
}

const CustomTooltip = ({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: number;
}) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'var(--bg-surface)',
      border: '1px solid var(--border-bright)',
      borderRadius: 4,
      padding: '6px 10px',
      fontFamily: '"JetBrains Mono", monospace',
      fontSize: 11,
    }}>
      <div style={{ color: 'var(--text-muted)' }}>{label ? formatTime(label) : ''}</div>
      <div style={{ color: 'var(--cyan)', fontWeight: 600 }}>
        {payload[0].value.toFixed(1)} Mbps
      </div>
    </div>
  );
};

export default function MetricsPanel() {
  const metrics = useVirexStore((s) => s.metrics);

  const chartData = metrics.throughputHistory.map((p: MetricPoint) => ({
    ts: p.timestamp,
    value: p.value,
  }));

  const rttColor = metrics.rtt > 100 ? 'var(--red)' : metrics.rtt > 50 ? 'var(--amber)' : 'var(--green)';
  const plColor  = metrics.packetLoss > 2 ? 'var(--red)' : metrics.packetLoss > 0.5 ? 'var(--amber)' : 'var(--green)';

  return (
    <div className="virex-panel" style={{ height: '100%' }}>
      <div className="virex-panel-header">
        <span className="virex-panel-title">Network Metrics</span>
        <span className="data" style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
          live · 1s interval
        </span>
      </div>

      {/* Stat cards */}
      <div style={{ display: 'flex', gap: 8, padding: '10px 12px 0' }}>
        <StatCard
          label="RTT"
          value={`${metrics.rtt.toFixed(0)}`}
          sub="milliseconds"
          color={rttColor}
        />
        <StatCard
          label="Throughput"
          value={`${metrics.throughput.toFixed(0)}`}
          sub="Mbps"
          color="var(--cyan)"
        />
        <StatCard
          label="Active Peers"
          value={String(metrics.activePeers)}
          sub="nodes"
          color="var(--blue)"
        />
        <StatCard
          label="Pkt Loss"
          value={`${metrics.packetLoss.toFixed(2)}%`}
          sub="ratio"
          color={plColor}
          blink={metrics.packetLoss > 3}
        />
      </div>

      {/* Throughput chart */}
      <div style={{ flex: 1, padding: '10px 12px 8px', minHeight: 0 }}>
        <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontFamily: 'Rajdhani, sans-serif', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>
          Throughput History
        </div>
        <div style={{ height: 'calc(100% - 20px)' }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 2, right: 4, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="tpGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#00d4ff" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#00d4ff" stopOpacity={0.01} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="rgba(26,45,71,0.6)"
                vertical={false}
              />
              <XAxis
                dataKey="ts"
                tickFormatter={formatTime}
                tick={{ fill: 'var(--text-muted)', fontSize: 9, fontFamily: '"JetBrains Mono", monospace' }}
                tickLine={false}
                axisLine={{ stroke: 'var(--border)' }}
                interval={9}
              />
              <YAxis
                tick={{ fill: 'var(--text-muted)', fontSize: 9, fontFamily: '"JetBrains Mono", monospace' }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => `${v}`}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="value"
                stroke="#00d4ff"
                strokeWidth={1.5}
                fill="url(#tpGrad)"
                dot={false}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
