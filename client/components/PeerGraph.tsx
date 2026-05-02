'use client';
import { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { useVirexStore } from '@/lib/store';
import type { Peer } from '@/lib/types';

interface D3Node extends d3.SimulationNodeDatum {
  id: string;
  peer: Peer;
}

interface D3Link extends d3.SimulationLinkDatum<D3Node> {
  source: string | D3Node;
  target: string | D3Node;
}

interface TooltipState {
  x: number;
  y: number;
  peer: Peer;
}

function trustColor(score: number, status: string): string {
  if (status === 'blacklisted') return '#ef4444';
  if (score >= 70) return '#22c55e';
  if (score >= 40) return '#f59e0b';
  return '#ef4444';
}

function formatUptime(seconds: number): string {
  if (seconds >= 86400) return `${(seconds / 86400).toFixed(1)}d`;
  if (seconds >= 3600)  return `${(seconds / 3600).toFixed(1)}h`;
  return `${Math.floor(seconds / 60)}m`;
}

export default function PeerGraph() {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const simRef = useRef<d3.Simulation<D3Node, D3Link> | null>(null);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const peers = useVirexStore((s) => s.peers);

  useEffect(() => {
    if (!svgRef.current || !containerRef.current) return;

    const container = containerRef.current;
    const { width, height } = container.getBoundingClientRect();
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const peerList = Object.values(peers);
    const nodes: D3Node[] = peerList.map((p) => ({ id: p.id, peer: p }));

    const linkSet = new Set<string>();
    const links: D3Link[] = [];
    peerList.forEach((peer) => {
      peer.connectedPeers.forEach((tid) => {
        if (!peers[tid]) return;
        const key = [peer.id, tid].sort().join('|');
        if (!linkSet.has(key)) {
          linkSet.add(key);
          links.push({ source: peer.id, target: tid });
        }
      });
    });

    // SVG defs
    const defs = svg.append('defs');
    const filter = defs.append('filter').attr('id', 'node-glow');
    filter.append('feGaussianBlur').attr('in', 'SourceGraphic').attr('stdDeviation', '3').attr('result', 'blur');
    const feMerge = filter.append('feMerge');
    feMerge.append('feMergeNode').attr('in', 'blur');
    feMerge.append('feMergeNode').attr('in', 'SourceGraphic');

    // Background
    svg.append('rect')
      .attr('width', width)
      .attr('height', height)
      .attr('fill', 'transparent');

    const g = svg.append('g');

    // Zoom
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 3])
      .on('zoom', (event) => {
        g.attr('transform', event.transform.toString());
      });
    svg.call(zoom);

    // Links
    const linkSel = g.append('g').attr('class', 'links')
      .selectAll<SVGLineElement, D3Link>('line')
      .data(links)
      .join('line')
      .attr('stroke', '#1e3d66')
      .attr('stroke-width', 1.2)
      .attr('stroke-opacity', 0.7);

    // Node groups
    const nodeSel = g.append('g').attr('class', 'nodes')
      .selectAll<SVGGElement, D3Node>('g')
      .data(nodes, (d) => d.id)
      .join('g')
      .attr('cursor', 'grab')
      .call(
        d3.drag<SVGGElement, D3Node>()
          .on('start', (event, d) => {
            if (!event.active) simRef.current?.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
          })
          .on('drag', (event, d) => {
            d.fx = event.x;
            d.fy = event.y;
          })
          .on('end', (event, d) => {
            if (!event.active) simRef.current?.alphaTarget(0);
            d.fx = null;
            d.fy = null;
          })
      );

    // Pulse ring for own node
    nodeSel.filter((d) => !!d.peer.isOwn)
      .append('circle')
      .attr('r', 22)
      .attr('fill', 'none')
      .attr('stroke', 'var(--cyan)')
      .attr('stroke-width', 1)
      .attr('opacity', 0.4)
      .attr('class', 'pulse-ring');

    // Main circle fill
    nodeSel.append('circle')
      .attr('r', (d) => d.peer.isOwn ? 14 : 9)
      .attr('fill', (d) => trustColor(d.peer.trustScore, d.peer.status))
      .attr('fill-opacity', 0.12)
      .attr('stroke', (d) => trustColor(d.peer.trustScore, d.peer.status))
      .attr('stroke-width', (d) => d.peer.isOwn ? 2.5 : 1.5)
      .attr('filter', 'url(#node-glow)');

    // Inner dot
    nodeSel.append('circle')
      .attr('r', (d) => d.peer.isOwn ? 4 : 2.5)
      .attr('fill', (d) => trustColor(d.peer.trustScore, d.peer.status))
      .attr('fill-opacity', 0.9);

    // Blacklist cross
    nodeSel.filter((d) => d.peer.status === 'blacklisted')
      .append('line')
      .attr('x1', -5).attr('y1', -5).attr('x2', 5).attr('y2', 5)
      .attr('stroke', '#ef4444').attr('stroke-width', 1.5);
    nodeSel.filter((d) => d.peer.status === 'blacklisted')
      .append('line')
      .attr('x1', 5).attr('y1', -5).attr('x2', -5).attr('y2', 5)
      .attr('stroke', '#ef4444').attr('stroke-width', 1.5);

    // Labels
    nodeSel.append('text')
      .text((d) => d.peer.isOwn ? 'YOU' : d.peer.shortId)
      .attr('text-anchor', 'middle')
      .attr('dy', (d) => d.peer.isOwn ? 28 : 22)
      .attr('fill', (d) => d.peer.isOwn ? 'var(--cyan)' : 'var(--text-muted)')
      .attr('font-size', (d) => d.peer.isOwn ? '10px' : '8.5px')
      .attr('font-family', '"JetBrains Mono", monospace')
      .attr('pointer-events', 'none');

    // Hover events
    nodeSel
      .on('mouseover', (event, d) => {
        const rect = container.getBoundingClientRect();
        setTooltip({
          x: event.clientX - rect.left,
          y: event.clientY - rect.top,
          peer: d.peer,
        });
      })
      .on('mousemove', (event, d) => {
        const rect = container.getBoundingClientRect();
        setTooltip({
          x: event.clientX - rect.left,
          y: event.clientY - rect.top,
          peer: d.peer,
        });
      })
      .on('mouseout', () => setTooltip(null));

    // Simulation
    const simulation = d3.forceSimulation(nodes)
      .force('link',
        d3.forceLink<D3Node, D3Link>(links)
          .id((d) => d.id)
          .distance(90)
          .strength(0.6)
      )
      .force('charge', d3.forceManyBody().strength(-220))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collide', d3.forceCollide(32));

    simRef.current = simulation;

    simulation.on('tick', () => {
      linkSel
        .attr('x1', (d) => (d.source as D3Node).x ?? 0)
        .attr('y1', (d) => (d.source as D3Node).y ?? 0)
        .attr('x2', (d) => (d.target as D3Node).x ?? 0)
        .attr('y2', (d) => (d.target as D3Node).y ?? 0);
      nodeSel.attr('transform', (d) => `translate(${d.x ?? 0},${d.y ?? 0})`);
    });

    return () => {
      simulation.stop();
    };
  }, [peers]);

  return (
    <div className="virex-panel" style={{ height: '100%' }}>
      <div className="virex-panel-header">
        <span className="virex-panel-title">Peer Topology</span>
        <div className="flex items-center gap-3">
          <LegendDot color="var(--green)"  label="Trusted" />
          <LegendDot color="var(--amber)"  label="Flagged" />
          <LegendDot color="var(--red)"    label="Blacklisted" />
        </div>
      </div>
      <div ref={containerRef} className="relative flex-1 bg-grid scanline" style={{ overflow: 'hidden' }}>
        <svg ref={svgRef} width="100%" height="100%" />
        {tooltip && (
          <PeerTooltip x={tooltip.x} y={tooltip.y} peer={tooltip.peer} />
        )}
      </div>
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: color, display: 'inline-block' }} />
      <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontFamily: 'Rajdhani, sans-serif', letterSpacing: '0.08em' }}>
        {label}
      </span>
    </div>
  );
}

function PeerTooltip({ x, y, peer }: { x: number; y: number; peer: Peer }) {
  const color = peer.status === 'blacklisted' ? '#ef4444'
    : peer.trustScore >= 70 ? '#22c55e'
    : peer.trustScore >= 40 ? '#f59e0b'
    : '#ef4444';

  const left = x + 16;
  const top  = y - 10;

  return (
    <div
      style={{
        position: 'absolute',
        left,
        top,
        background: 'var(--bg-surface)',
        border: `1px solid ${color}`,
        borderRadius: 4,
        padding: '8px 12px',
        fontFamily: '"JetBrains Mono", monospace',
        fontSize: 11,
        pointerEvents: 'none',
        zIndex: 100,
        boxShadow: `0 4px 24px rgba(0,0,0,0.6), 0 0 12px ${color}33`,
        minWidth: 180,
      }}
    >
      <div style={{ color, fontWeight: 700, marginBottom: 6, fontSize: 12 }}>
        {peer.isOwn ? '⬡ LOCAL NODE' : peer.shortId}
      </div>
      <Row label="Trust"     value={`${peer.trustScore.toFixed(1)}`}      color={color} />
      <Row label="Latency"   value={`${peer.latency.toFixed(0)} ms`} />
      <Row label="Bandwidth" value={`${peer.bandwidth.toFixed(1)} Mbps`} />
      <Row label="Pkt Loss"  value={`${peer.packetLoss.toFixed(2)}%`} />
      <Row label="Uptime"    value={formatUptime(peer.uptime)} />
      <Row label="Status"    value={peer.status.toUpperCase()} color={color} />
    </div>
  );
}

function Row({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 3 }}>
      <span style={{ color: 'var(--text-muted)' }}>{label}</span>
      <span style={{ color: color ?? 'var(--text-primary)', fontWeight: 500 }}>{value}</span>
    </div>
  );
}
