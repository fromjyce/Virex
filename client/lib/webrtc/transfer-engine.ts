/**
 * TransferEngine — orchestrates multi-peer parallel file transfers.
 *
 * Upload: chunks a File, distributes chunks across trusted peers,
 *         retries failed chunks on alternate peers.
 *
 * Download: receives chunks from multiple peers, verifies SHA-256
 *           per chunk, reassembles in order.
 *
 * Chunk size adapts based on measured bandwidth:
 *   - bandwidth > 100 Mbps → 512 KB chunks
 *   - bandwidth 10–100 Mbps → 256 KB chunks
 *   - bandwidth < 10 Mbps  → 64 KB chunks
 */
import { sha256, verifyChunk } from '../security/crypto';
import type { PeerConnection } from './peer-connection';
import type { Transfer } from '../types';

const CHUNK_SIZES = {
  high:   512 * 1024,
  medium: 256 * 1024,
  low:     64 * 1024,
} as const;

function chunkSize(bandwidthMbps: number): number {
  if (bandwidthMbps > 100) return CHUNK_SIZES.high;
  if (bandwidthMbps > 10)  return CHUNK_SIZES.medium;
  return CHUNK_SIZES.low;
}

interface PeerSlot {
  conn: PeerConnection;
  bandwidthMbps: number;
}

interface PendingChunk {
  index: number;
  data: ArrayBuffer;
  hash: string;
  attempts: number;
}

export class TransferEngine {
  private uploads:   Map<string, UploadSession>   = new Map();
  private downloads: Map<string, DownloadSession> = new Map();

  startUpload(
    file: File,
    transferId: string,
    peers: PeerSlot[],
    onProgress: (pct: number, speed: number) => void,
    onComplete: () => void,
    onError: (err: Error) => void
  ): void {
    const session = new UploadSession(file, transferId, peers, onProgress, onComplete, onError);
    this.uploads.set(transferId, session);
    session.start().finally(() => this.uploads.delete(transferId));
  }

  registerDownload(
    transferId: string,
    expectedChunks: number,
    expectedFileHash: string,
    onProgress: (pct: number, speed: number, receivedChunks: number[]) => void,
    onComplete: (blob: Blob) => void,
    onError: (err: Error) => void
  ): (chunkIndex: number, data: ArrayBuffer, hash: string) => void {
    const session = new DownloadSession(
      transferId, expectedChunks, expectedFileHash,
      onProgress, onComplete, onError
    );
    this.downloads.set(transferId, session);

    return (index: number, data: ArrayBuffer, hash: string) => {
      session.receiveChunk(index, data, hash);
      if (session.isComplete) this.downloads.delete(transferId);
    };
  }

  abort(transferId: string) {
    this.uploads.get(transferId)?.abort();
    this.downloads.get(transferId)?.abort();
  }
}

class UploadSession {
  private aborted = false;

  constructor(
    private file: File,
    private id: string,
    private peers: PeerSlot[],
    private onProgress: (pct: number, speed: number) => void,
    private onComplete: () => void,
    private onError: (err: Error) => void
  ) {}

  async start(): Promise<void> {
    const avgBw = this.peers.reduce((s, p) => s + p.bandwidthMbps, 0) / this.peers.length;
    const size  = chunkSize(avgBw);
    const total = Math.ceil(this.file.size / size);
    const buf   = await this.file.arrayBuffer();

    const pending: PendingChunk[] = [];
    for (let i = 0; i < total; i++) {
      const slice = buf.slice(i * size, (i + 1) * size);
      const hash  = await sha256(slice);
      pending.push({ index: i, data: slice, hash, attempts: 0 });
    }

    let sent       = 0;
    const start    = Date.now();

    while (pending.length > 0 && !this.aborted) {
      const batch = pending.splice(0, this.peers.length);
      await Promise.all(
        batch.map(async (chunk, pi) => {
          const peer = this.peers[pi % this.peers.length];
          const ok   = peer.conn.sendChunk(this.id, chunk.index, chunk.data, chunk.hash);
          if (!ok) {
            chunk.attempts++;
            if (chunk.attempts < 3) {
              pending.push(chunk);
            } else {
              this.onError(new Error(`Chunk ${chunk.index} failed after 3 attempts`));
            }
          } else {
            sent++;
          }
        })
      );

      const elapsed = (Date.now() - start) / 1000;
      const speed   = (sent * size) / elapsed;
      this.onProgress((sent / total) * 100, speed);
      await new Promise((r) => setTimeout(r, 10));
    }

    if (!this.aborted) this.onComplete();
  }

  abort() {
    this.aborted = true;
  }
}

class DownloadSession {
  private chunks: Map<number, ArrayBuffer> = new Map();
  private startTime = Date.now();
  isComplete = false;
  private _aborted = false;

  constructor(
    private id: string,
    private total: number,
    private expectedHash: string,
    private onProgress: (pct: number, speed: number, received: number[]) => void,
    private onComplete: (blob: Blob) => void,
    private onError: (err: Error) => void
  ) {}

  async receiveChunk(index: number, data: ArrayBuffer, hash: string): Promise<void> {
    if (this._aborted || this.isComplete) return;

    const valid = await verifyChunk(data, hash);
    if (!valid) {
      this.onError(new Error(`Integrity failure: chunk ${index} hash mismatch`));
      return;
    }

    this.chunks.set(index, data);
    const received = this.chunks.size;
    const elapsed  = (Date.now() - this.startTime) / 1000 || 0.001;
    const speed    = Array.from(this.chunks.values()).reduce((s, c) => s + c.byteLength, 0) / elapsed;

    this.onProgress((received / this.total) * 100, speed, Array.from(this.chunks.keys()));

    if (received === this.total) {
      await this.assemble();
    }
  }

  abort() {
    this._aborted = true;
  }

  private async assemble() {
    const parts: ArrayBuffer[] = [];
    for (let i = 0; i < this.total; i++) {
      const chunk = this.chunks.get(i);
      if (!chunk) {
        this.onError(new Error(`Missing chunk ${i} during reassembly`));
        return;
      }
      parts.push(chunk);
    }

    const blob = new Blob(parts);

    // Verify overall file hash
    const fileBuf  = await blob.arrayBuffer();
    const fileHash = await sha256(fileBuf);
    if (this.expectedHash && fileHash !== this.expectedHash) {
      this.onError(new Error('Full file hash mismatch — transfer corrupted'));
      return;
    }

    this.isComplete = true;
    this.onComplete(blob);
  }
}
