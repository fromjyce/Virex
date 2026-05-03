# Virex — Intelligent Secure P2P Data Network

A decentralized, WebRTC-based peer-to-peer data network with AI-driven peer selection, real-time threat detection, adaptive transfer optimization, and a live network operations dashboard.

## Architecture

```
client/             Next.js 14 dashboard + WebRTC P2P layer
signaling-server/   Node.js WebSocket signaling (stateless)
ml-engine/          Python FastAPI — peer ranking, anomaly detection, trust scoring
```

```
Browser (Virex Dashboard)
      │
      ├── WebRTC DataChannels ←→ Peer Network
      │
      └── WebSocket ←→ Signaling Server (port 8080)
                              │
                    (optional) ML Engine (port 8000)
```

## Quick Start

### 1. Signaling Server

```bash
cd signaling-server
npm install
npm run dev
```

Server runs on `http://localhost:8080`.
- `GET /health` — status + peer count
- `GET /peers`  — current peer list with uptime

### 2. ML Engine

```bash
cd ml-engine
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn api:app --host 0.0.0.0 --port 8000 --reload
```

API docs at `http://localhost:8000/docs`.

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/rank-peers` | Rank candidates for transfer |
| POST | `/api/v1/detect-anomalies` | Isolation Forest + rule checks |
| POST | `/api/v1/trust-score` | Compute single peer trust score |
| POST | `/api/v1/trust-score/batch` | Batch trust computation |

### 3. Client Dashboard

```bash
cd client
npm install
npm run dev   # http://localhost:3000
```

`.env.local`:
```
NEXT_PUBLIC_SIGNALING_URL=ws://localhost:8080
NEXT_PUBLIC_ML_URL=http://localhost:8000
```

## Feature Map

| Feature | Location | Status |
|---------|----------|--------|
| WebRTC P2P connections | `client/lib/webrtc/peer-connection.ts` | Ready |
| Chunked parallel transfer | `client/lib/webrtc/transfer-engine.ts` | Ready |
| SHA-256 per-chunk verification | `client/lib/security/crypto.ts` | Ready |
| Ed25519 peer authentication | `client/lib/security/crypto.ts` | Ready |
| Dynamic trust scoring | `client/lib/security/trust-score.ts` | Ready |
| WebSocket signaling | `signaling-server/src/server.ts` | Ready |
| Peer Selection (weighted) | `ml-engine/models/peer_selector.py` | Ready |
| Peer Selection (XGBoost) | `ml-engine/models/peer_selector.py` | Auto-activates ≥100 samples |
| Anomaly Detection (rules) | `ml-engine/models/anomaly_detector.py` | Ready |
| Anomaly Detection (Isolation Forest) | `ml-engine/models/anomaly_detector.py` | Auto-activates ≥50 samples |
| SOC Dashboard | `client/components/` | Ready |
| Peer graph (D3 force-directed) | `client/components/PeerGraph.tsx` | Ready |
| Simulation engine | `client/components/SimulationPanel.tsx` | Ready |

## Security Model

- **Peer Auth**: Ed25519 keypair per node; public key in signaling; signature verified before data exchange.
- **Channel Encryption**: WebRTC DTLS (built-in) + XSalsa20-Poly1305 payload encryption.
- **Data Integrity**: SHA-256 per chunk — corrupted/poisoned chunks rejected immediately.
- **Trust Score**: Composite across 6 dimensions; auto-blacklist ≤15, flagged ≤50.
- **Anomaly Detection**: Rule thresholds + Isolation Forest; detects floods, Sybil peers, poisoned data.

---

## Contact

If you come across any issues, have suggestions for improvement, or want to discuss further enhancements, feel free to contact me at [jaya2004kra@gmail.com](mailto:jaya2004kra@gmail.com). Your feedback is greatly appreciated.

---

## License

All the code and resources in this repository are licensed under the GNU General Public License. You are free to use, modify, and distribute the code under the terms of this license. However, I do not take responsibility for the accuracy or reliability of the programs.
