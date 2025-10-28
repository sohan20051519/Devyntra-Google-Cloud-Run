// Minimal WebSocket relay for deployment updates
// Streams Firestore deployment doc changes to clients via WS

const http = require('http');
const url = require('url');
const WebSocket = require('ws');
const admin = require('firebase-admin');

// Initialize Firebase Admin once (uses default credentials on Cloud Run)
try {
  if (!admin.apps.length) {
    admin.initializeApp();
  }
} catch {}
const db = admin.firestore();

const server = http.createServer((req, res) => {
  if (req.url === '/' || req.url?.startsWith('/healthz')) {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('ok');
    return;
  }
  res.writeHead(404);
  res.end('not found');
});

const wss = new WebSocket.Server({ noServer: true });

wss.on('connection', async (ws, request, clientInfo) => {
  let unsub = null;
  try {
    const parsed = url.parse(request.url, true);
    const q = parsed.query || {};
    const deploymentId = (q.deploymentId || q.id || '').toString();
    const token = (q.token || '').toString();

    if (!deploymentId) {
      ws.close(1008, 'deploymentId required');
      return;
    }

    // Verify Firebase ID token if provided (recommended)
    if (token) {
      try {
        await admin.auth().verifyIdToken(token);
      } catch (e) {
        ws.close(1008, 'unauthorized');
        return;
      }
    }

    const ref = db.collection('deployments').doc(deploymentId);

    unsub = ref.onSnapshot((snap) => {
      try {
        if (!snap.exists) {
          ws.send(JSON.stringify({ id: deploymentId, status: 'unknown' }));
          return;
        }
        const data = snap.data() || {};
        const slim = {
          id: deploymentId,
          status: data.status,
          message: data.message,
          deploySubstep: data.deploySubstep,
          deploymentUrl: data.deploymentUrl || null,
          logs: Array.isArray(data.logs) ? data.logs.slice(-10) : undefined,
        };
        ws.send(JSON.stringify(slim));
        if (data.status === 'deployed' || data.status === 'failed' || data.status === 'cancelled') {
          try { ws.close(1000, 'completed'); } catch {}
          if (unsub) { try { unsub(); } catch {} }
        }
      } catch {}
    }, (err) => {
      try { ws.close(1011, 'snapshot error'); } catch {}
    });

    ws.on('close', () => { if (unsub) { try { unsub(); } catch {} } });
    ws.on('error', () => { if (unsub) { try { unsub(); } catch {} } });
  } catch (e) {
    try { ws.close(1011, 'internal'); } catch {}
    if (unsub) { try { unsub(); } catch {} }
  }
});

server.on('upgrade', (request, socket, head) => {
  const pathname = url.parse(request.url).pathname;
  if (pathname === '/ws') {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  } else {
    socket.destroy();
  }
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`ws-relay listening on :${PORT}`);
});
