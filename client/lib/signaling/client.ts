/**
 * WebSocket signaling client.
 *
 * Handles: register, peer_list, peer_joined, peer_left,
 * offer/answer/ice_candidate relay, peer_stats_update.
 *
 * Stateless — all WebRTC state lives in PeerConnection instances.
 */

export type SignalingMessage =
  | { type: 'register';            payload: { peerId: string; publicKey: string } }
  | { type: 'peer_list';           payload: { peers: Array<{ peerId: string; publicKey: string }> } }
  | { type: 'peer_joined';         payload: { peerId: string; publicKey: string } }
  | { type: 'peer_left';           payload: { peerId: string } }
  | { type: 'offer';               from: string; to: string; payload: RTCSessionDescriptionInit }
  | { type: 'answer';              from: string; to: string; payload: RTCSessionDescriptionInit }
  | { type: 'ice_candidate';       from: string; to: string; payload: RTCIceCandidateInit }
  | { type: 'peer_stats_update';   payload: { peerId: string; latency: number; bandwidth: number } }
  | { type: 'ping' }
  | { type: 'pong'; timestamp: number };

type Handler = (msg: SignalingMessage) => void;

export class SignalingClient {
  private ws: WebSocket | null = null;
  private handlers = new Set<Handler>();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private pingInterval: ReturnType<typeof setInterval> | null = null;
  private _connected = false;

  constructor(
    private url: string,
    private peerId: string,
    private publicKey: string
  ) {}

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        this._connected = true;
        this.send({ type: 'register', payload: { peerId: this.peerId, publicKey: this.publicKey } });
        this.startPing();
        resolve();
      };

      this.ws.onmessage = (event) => {
        try {
          const msg: SignalingMessage = JSON.parse(event.data as string);
          this.handlers.forEach((h) => h(msg));
        } catch {
          // ignore malformed
        }
      };

      this.ws.onclose = () => {
        this._connected = false;
        this.stopPing();
        this.scheduleReconnect();
      };

      this.ws.onerror = (err) => {
        reject(err);
      };
    });
  }

  send(msg: SignalingMessage) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  on(handler: Handler): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  get connected() {
    return this._connected;
  }

  disconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.stopPing();
    this.ws?.close();
    this.ws = null;
  }

  private startPing() {
    this.pingInterval = setInterval(() => {
      this.send({ type: 'ping' });
    }, 15_000);
  }

  private stopPing() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  private scheduleReconnect() {
    this.reconnectTimer = setTimeout(() => {
      this.connect().catch(() => {});
    }, 3000);
  }
}
