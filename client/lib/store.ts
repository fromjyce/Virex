import { create } from 'zustand';
import type {
  Peer,
  Transfer,
  Alert,
  NetworkMetrics,
  SimulationEvent,
  MetricPoint,
} from './types';

function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

interface VirexStore {
  ownPeerId: string;
  connectionState: 'connected' | 'disconnected' | 'connecting';
  peers: Record<string, Peer>;
  transfers: Record<string, Transfer>;
  alerts: Alert[];
  metrics: NetworkMetrics;
  simulationLog: SimulationEvent[];

  setConnectionState: (s: 'connected' | 'disconnected' | 'connecting') => void;
  addPeer: (peer: Peer) => void;
  updatePeer: (id: string, updates: Partial<Peer>) => void;
  blacklistPeer: (id: string) => void;
  removePeer: (id: string) => void;
  addTransfer: (transfer: Transfer) => void;
  updateTransfer: (id: string, updates: Partial<Transfer>) => void;
  addAlert: (alert: Omit<Alert, 'id'>) => void;
  resolveAlert: (id: string) => void;
  updateMetrics: (updates: Partial<NetworkMetrics>) => void;
  pushMetricPoint: (key: 'throughputHistory' | 'rttHistory', point: MetricPoint) => void;
  addSimulationEvent: (event: Omit<SimulationEvent, 'id'>) => void;
}

const OWN_PEER_ID = 'peer_' + uid();

export const useVirexStore = create<VirexStore>((set) => ({
  ownPeerId: OWN_PEER_ID,
  connectionState: 'connected',
  peers: {},
  transfers: {},
  alerts: [],
  metrics: {
    rtt: 0,
    throughput: 0,
    activePeers: 0,
    packetLoss: 0,
    throughputHistory: [],
    rttHistory: [],
  },
  simulationLog: [],

  setConnectionState: (connectionState) => set({ connectionState }),

  addPeer: (peer) =>
    set((s) => ({ peers: { ...s.peers, [peer.id]: peer } })),

  updatePeer: (id, updates) =>
    set((s) => ({
      peers: s.peers[id]
        ? { ...s.peers, [id]: { ...s.peers[id], ...updates } }
        : s.peers,
    })),

  blacklistPeer: (id) =>
    set((s) => ({
      peers: s.peers[id]
        ? {
            ...s.peers,
            [id]: { ...s.peers[id], status: 'blacklisted', trustScore: 0 },
          }
        : s.peers,
    })),

  removePeer: (id) =>
    set((s) => {
      const { [id]: _removed, ...rest } = s.peers;
      return { peers: rest };
    }),

  addTransfer: (transfer) =>
    set((s) => ({ transfers: { ...s.transfers, [transfer.id]: transfer } })),

  updateTransfer: (id, updates) =>
    set((s) => ({
      transfers: s.transfers[id]
        ? { ...s.transfers, [id]: { ...s.transfers[id], ...updates } }
        : s.transfers,
    })),

  addAlert: (alert) =>
    set((s) => ({
      alerts: [{ ...alert, id: uid() }, ...s.alerts].slice(0, 200),
    })),

  resolveAlert: (id) =>
    set((s) => ({
      alerts: s.alerts.map((a) => (a.id === id ? { ...a, resolved: true } : a)),
    })),

  updateMetrics: (updates) =>
    set((s) => ({ metrics: { ...s.metrics, ...updates } })),

  pushMetricPoint: (key, point) =>
    set((s) => ({
      metrics: {
        ...s.metrics,
        [key]: [...s.metrics[key], point].slice(-60),
      },
    })),

  addSimulationEvent: (event) =>
    set((s) => ({
      simulationLog: [{ ...event, id: uid() }, ...s.simulationLog].slice(0, 100),
    })),
}));
