import 'dotenv/config';
import { createServer, IncomingMessage } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { PeerRegistry } from './peer-registry';
import { SessionManager } from './session-manager';

const PORT = parseInt(process.env.PORT ?? '8080', 10);
const CORS_ORIGIN = process.env.CORS_ORIGIN ?? '*';

interface BaseMessage { type: string }
interface RegisterMsg  extends BaseMessage { type: 'register';      payload: { peerId: string; publicKey: string } }
interface OfferMsg     extends BaseMessage { type: 'offer';         from: string; to: string; payload: object }
interface AnswerMsg    extends BaseMessage { type: 'answer';        from: string; to: string; payload: object }
interface IceMsg       extends BaseMessage { type: 'ice_candidate'; from: string; to: string; payload: object }
interface StatsMsg     extends BaseMessage { type: 'peer_stats';    payload: { latency: number; bandwidth: number } }
interface PingMsg      extends BaseMessage { type: 'ping' }

type ClientMessage = RegisterMsg | OfferMsg | AnswerMsg | IceMsg | StatsMsg | PingMsg;

const registry = new PeerRegistry();
const sessions  = new SessionManager();

// Evict stale sessions every 30 seconds
setInterval(() => {
  const evicted = sessions.evictStale();
  if (evicted > 0) console.log(`[sessions] evicted ${evicted} stale session(s)`);
}, 30_000);

const httpServer = createServer((req: IncomingMessage, res) => {
  res.setHeader('Access-Control-Allow-Origin', CORS_ORIGIN);
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', peers: registry.count(), ts: Date.now() }));
    return;
  }
  if (req.url === '/peers') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(registry.snapshot()));
    return;
  }
  res.writeHead(404);
  res.end();
});

const wss = new WebSocketServer({ server: httpServer });

wss.on('connection', (ws: WebSocket) => {
  let peerId: string | null = null;

  ws.on('message', (raw: Buffer) => {
    let msg: ClientMessage;
    try {
      msg = JSON.parse(raw.toString()) as ClientMessage;
    } catch {
      return;
    }

    switch (msg.type) {
      case 'register': {
        if (peerId) {
          registry.unregister(peerId);
        }
        peerId = msg.payload.peerId;
        registry.register(peerId, ws, msg.payload.publicKey);

        ws.send(JSON.stringify({
          type:    'peer_list',
          payload: { peers: registry.getPeerList(peerId) },
        }));

        registry.broadcast(peerId, {
          type:    'peer_joined',
          payload: { peerId, publicKey: msg.payload.publicKey },
        });

        console.log(`[+] ${peerId.slice(0, 12)} registered — total: ${registry.count()}`);
        break;
      }

      case 'offer': {
        const target = registry.get(msg.to);
        if (!target) break;
        sessions.initiate(msg.from, msg.to);
        target.send(JSON.stringify({ ...msg, from: peerId }));
        break;
      }

      case 'answer': {
        const target = registry.get(msg.to);
        if (!target) break;
        sessions.advance(msg.from, msg.to, 'answer_sent');
        target.send(JSON.stringify({ ...msg, from: peerId }));
        break;
      }

      case 'ice_candidate': {
        const target = registry.get(msg.to);
        if (target) {
          target.send(JSON.stringify({ ...msg, from: peerId }));
        }
        break;
      }

      case 'peer_stats': {
        if (!peerId) break;
        registry.broadcast(peerId, {
          type:    'peer_stats_update',
          payload: { peerId, ...msg.payload },
        });
        break;
      }

      case 'ping': {
        ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
        break;
      }
    }
  });

  ws.on('close', () => {
    if (peerId) {
      registry.unregister(peerId);
      registry.broadcast(peerId, { type: 'peer_left', payload: { peerId } });
      console.log(`[-] ${peerId.slice(0, 12)} disconnected — total: ${registry.count()}`);
    }
  });

  ws.on('error', (err: Error) => {
    console.error(`[ws] error for peer ${peerId ?? 'unknown'}: ${err.message}`);
  });
});

httpServer.listen(PORT, () => {
  console.log(`[virex] signaling server listening on :${PORT}`);
  console.log(`        health → http://localhost:${PORT}/health`);
  console.log(`        peers  → http://localhost:${PORT}/peers`);
});
