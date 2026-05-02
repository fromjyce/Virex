/**
 * Tracks in-progress SDP negotiation sessions so that stale
 * offers/answers can be detected and discarded.
 */

interface Session {
  initiator: string;
  responder: string;
  state: 'offer_sent' | 'answer_sent' | 'established';
  createdAt: number;
}

const SESSION_TTL_MS = 30_000;

export class SessionManager {
  private sessions = new Map<string, Session>();

  private key(a: string, b: string): string {
    return [a, b].sort().join('|');
  }

  initiate(initiator: string, responder: string): void {
    const k = this.key(initiator, responder);
    this.sessions.set(k, {
      initiator,
      responder,
      state: 'offer_sent',
      createdAt: Date.now(),
    });
  }

  advance(a: string, b: string, state: Session['state']): boolean {
    const k   = this.key(a, b);
    const ses = this.sessions.get(k);
    if (!ses) return false;
    ses.state = state;
    return true;
  }

  get(a: string, b: string): Session | undefined {
    return this.sessions.get(this.key(a, b));
  }

  remove(a: string, b: string): void {
    this.sessions.delete(this.key(a, b));
  }

  /** Evict sessions older than TTL to avoid memory leaks. */
  evictStale(): number {
    const now = Date.now();
    let count = 0;
    for (const [k, s] of this.sessions) {
      if (now - s.createdAt > SESSION_TTL_MS) {
        this.sessions.delete(k);
        count++;
      }
    }
    return count;
  }
}
