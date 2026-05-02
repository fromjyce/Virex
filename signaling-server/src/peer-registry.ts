import { WebSocket } from 'ws';

export interface PeerEntry {
  peerId:    string;
  socket:    WebSocket;
  publicKey: string;
  joinedAt:  number;
}

export class PeerRegistry {
  private peers = new Map<string, PeerEntry>();

  register(peerId: string, socket: WebSocket, publicKey: string): void {
    this.peers.set(peerId, { peerId, socket, publicKey, joinedAt: Date.now() });
  }

  unregister(peerId: string): void {
    this.peers.delete(peerId);
  }

  get(peerId: string): WebSocket | undefined {
    return this.peers.get(peerId)?.socket;
  }

  has(peerId: string): boolean {
    return this.peers.has(peerId);
  }

  count(): number {
    return this.peers.size;
  }

  getPeerList(excludeId: string): Array<{ peerId: string; publicKey: string }> {
    const result: Array<{ peerId: string; publicKey: string }> = [];
    for (const [id, entry] of this.peers) {
      if (id !== excludeId) {
        result.push({ peerId: id, publicKey: entry.publicKey });
      }
    }
    return result;
  }

  broadcast(excludeId: string, message: object): void {
    const payload = JSON.stringify(message);
    for (const [id, entry] of this.peers) {
      if (id !== excludeId && entry.socket.readyState === WebSocket.OPEN) {
        entry.socket.send(payload);
      }
    }
  }

  snapshot(): Array<{ peerId: string; publicKey: string; uptime: number }> {
    const now = Date.now();
    return Array.from(this.peers.values()).map((e) => ({
      peerId:    e.peerId,
      publicKey: e.publicKey,
      uptime:    Math.floor((now - e.joinedAt) / 1000),
    }));
  }
}
