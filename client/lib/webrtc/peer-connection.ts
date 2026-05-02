/**
 * Manages a single RTCPeerConnection to one remote peer.
 *
 * Responsibilities:
 *   - SDP offer/answer negotiation via the SignalingClient
 *   - ICE candidate exchange
 *   - DataChannel creation (reliable + ordered for control,
 *     unreliable for bulk chunk transfers)
 *   - Latency measurement via DataChannel ping/pong
 *   - Forwarding incoming chunks to TransferEngine
 */
import type { SignalingClient } from '../signaling/client';

export type DataChannelMessage =
  | { type: 'chunk';      transferId: string; index: number; data: ArrayBuffer; hash: string }
  | { type: 'chunk_ack';  transferId: string; index: number }
  | { type: 'ping';       ts: number }
  | { type: 'pong';       ts: number }
  | { type: 'handshake';  peerId: string; publicKey: string; signature: string }
  | { type: 'trust_req' }
  | { type: 'trust_res';  score: number };

type ChunkHandler = (msg: DataChannelMessage & { type: 'chunk' }) => void;

export class PeerConnection {
  private pc: RTCPeerConnection;
  private controlChannel: RTCDataChannel | null = null;
  private dataChannel:    RTCDataChannel | null = null;
  private latencyMs  = 0;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private chunkHandlers = new Set<ChunkHandler>();

  readonly remotePeerId: string;

  constructor(
    remotePeerId: string,
    private signaling: SignalingClient,
    private ownPeerId: string,
    config: RTCConfiguration = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
      ],
    }
  ) {
    this.remotePeerId = remotePeerId;
    this.pc = new RTCPeerConnection(config);

    this.pc.onicecandidate = ({ candidate }) => {
      if (candidate) {
        this.signaling.send({
          type: 'ice_candidate',
          from: this.ownPeerId,
          to:   this.remotePeerId,
          payload: candidate.toJSON(),
        });
      }
    };

    this.pc.ondatachannel = ({ channel }) => {
      if (channel.label === 'control') this.setupControlChannel(channel);
      if (channel.label === 'data')    this.setupDataChannel(channel);
    };
  }

  async initiateOffer(): Promise<void> {
    this.controlChannel = this.pc.createDataChannel('control', { ordered: true });
    this.dataChannel    = this.pc.createDataChannel('data',    { ordered: false, maxRetransmits: 0 });
    this.setupControlChannel(this.controlChannel);
    this.setupDataChannel(this.dataChannel);

    const offer = await this.pc.createOffer();
    await this.pc.setLocalDescription(offer);
    this.signaling.send({
      type: 'offer',
      from: this.ownPeerId,
      to:   this.remotePeerId,
      payload: offer,
    });
  }

  async handleOffer(offer: RTCSessionDescriptionInit): Promise<void> {
    await this.pc.setRemoteDescription(offer);
    const answer = await this.pc.createAnswer();
    await this.pc.setLocalDescription(answer);
    this.signaling.send({
      type: 'answer',
      from: this.ownPeerId,
      to:   this.remotePeerId,
      payload: answer,
    });
  }

  async handleAnswer(answer: RTCSessionDescriptionInit): Promise<void> {
    await this.pc.setRemoteDescription(answer);
  }

  async handleIceCandidate(candidate: RTCIceCandidateInit): Promise<void> {
    await this.pc.addIceCandidate(candidate);
  }

  sendChunk(transferId: string, index: number, data: ArrayBuffer, hash: string): boolean {
    if (this.dataChannel?.readyState !== 'open') return false;
    const header = JSON.stringify({ type: 'chunk', transferId, index, hash });
    const enc    = new TextEncoder();
    const headerBytes = enc.encode(header + '\n');
    const combined    = new Uint8Array(headerBytes.byteLength + data.byteLength);
    combined.set(headerBytes, 0);
    combined.set(new Uint8Array(data), headerBytes.byteLength);
    this.dataChannel.send(combined.buffer);
    return true;
  }

  onChunk(handler: ChunkHandler): () => void {
    this.chunkHandlers.add(handler);
    return () => this.chunkHandlers.delete(handler);
  }

  get latency() {
    return this.latencyMs;
  }

  close() {
    if (this.pingTimer) clearInterval(this.pingTimer);
    this.controlChannel?.close();
    this.dataChannel?.close();
    this.pc.close();
  }

  private setupControlChannel(ch: RTCDataChannel) {
    this.controlChannel = ch;
    ch.onopen = () => {
      this.startPing();
    };
    ch.onmessage = (event) => {
      try {
        const msg: DataChannelMessage = JSON.parse(event.data as string);
        if (msg.type === 'pong') {
          this.latencyMs = Date.now() - msg.ts;
        }
      } catch { /* ignore */ }
    };
  }

  private setupDataChannel(ch: RTCDataChannel) {
    this.dataChannel = ch;
    ch.binaryType = 'arraybuffer';
    ch.onmessage = (event) => {
      try {
        const buf  = event.data as ArrayBuffer;
        const view = new Uint8Array(buf);
        const nl   = view.indexOf(0x0a); // '\n'
        if (nl === -1) return;
        const header: DataChannelMessage = JSON.parse(
          new TextDecoder().decode(view.slice(0, nl))
        );
        if (header.type === 'chunk') {
          const chunkData = buf.slice(nl + 1);
          this.chunkHandlers.forEach((h) => h({ ...header, data: chunkData }));
        }
      } catch { /* ignore */ }
    };
  }

  private startPing() {
    this.pingTimer = setInterval(() => {
      if (this.controlChannel?.readyState === 'open') {
        this.controlChannel.send(JSON.stringify({ type: 'ping', ts: Date.now() }));
      }
    }, 5000);
  }
}
