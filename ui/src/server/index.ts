import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { CognitiveEventSource } from '@senars/core';
import { errMsg } from '@senars/nar/utils';
import { WebSocket, WebSocketServer } from 'ws';
import type { LensSpec } from '@senars/core/lens-schema';
import type { IncomingFromServer, Lens } from '@senars/core/protocol';
import { onChat } from './chat.js';
import { type CognitiveBridge, createCognitiveBridge } from './cognitive-bridge.js';
import { handleConnection, initLensRegistry } from './gateway.js';
import { createStaticHandler } from './static.js';
import { createTestControlHandler } from './test-control.js';
import { bootstrapNAR } from './bootstrap.js';
import type { NAR } from '@senars/nar';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_PORT = 3000;

export interface TestServer {
  close(): Promise<void>;
  address(): { port: number };
}

export async function startWebUI(source: CognitiveEventSource): Promise<TestServer> {
  const bridge = createCognitiveBridge();
  initLensRegistry();
  return startHttpServer(bridge, source, DEFAULT_PORT, path.join(__dirname, '..', '..', 'dist', 'client'));
}

export async function startWebUIWithOptions(
  source: CognitiveEventSource,
  options: { port?: number; clientDist?: string } = {}
): Promise<TestServer> {
  const bridge = createCognitiveBridge();
  const distRoot = options.clientDist ?? path.join(__dirname, '..', '..', 'dist', 'client');
  return startHttpServer(bridge, source, options.port ?? DEFAULT_PORT, distRoot);
}

export async function startWebUIWithNAR(
  nar: NAR,
  source: CognitiveEventSource,
  options: { port?: number; clientDist?: string; bootstrap?: boolean } = {}
): Promise<TestServer> {
  const bridge = createCognitiveBridge(nar);
  initLensRegistry();
  const distRoot = options.clientDist ?? path.join(__dirname, '..', '..', 'dist', 'client');

  // Bootstrap NAR BEFORE bridge.mount (original behavior - works for 23 tests)
  if (options.bootstrap !== false) {
    await bootstrapNAR(nar);
  }

  return startHttpServer(bridge, source, options.port ?? DEFAULT_PORT, distRoot, nar);
}

function startHttpServer(
  bridge: CognitiveBridge,
  source: CognitiveEventSource,
  port: number,
  distRoot: string,
  nar?: NAR
): Promise<TestServer> {
  const handleHttp = createStaticHandler(distRoot);
  const testControlHandler = nar ? createTestControlHandler(nar) : null;

  const server = http.createServer(async (req, res) => {
    const pathname = new URL(req.url ?? '/', `http://${req.headers.host}`).pathname;
    if (pathname.startsWith('/test/')) {
      // Test control endpoints
      if (pathname === '/test/reset' && req.method === 'POST') {
        try {
          console.log('[TestControl] Reset requested');
          console.log('[TestControl] Bridge state before reset:', bridge.listConcepts().length);
          console.log('[TestControl] NAR concepts before reset:', nar?.listConcepts().length);
          bridge.reset();
          if (nar) {
            nar.clearMemory();
            await bootstrapNAR(nar);
            bridge.syncFromNAR();
          }
          console.log('[TestControl] Bridge state after reset:', bridge.listConcepts().length);
          console.log('[TestControl] NAR concepts after reset:', nar?.listConcepts().length);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, message: 'Bridge and NAR reset' }));
        } catch (e) {
          res.writeHead(500);
          res.end(JSON.stringify({ error: String(e) }));
        }
        return;
      }
      if (testControlHandler) {
        return testControlHandler(req, res, pathname);
      }
      if (pathname === '/test/debug' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          bridgeConcepts: bridge.listConcepts().length,
          narConcepts: nar?.listConcepts().length,
          bridgeEdges: bridge.listConcepts().reduce((sum, c) => sum + (c.getLinks?.()?.length ?? 0), 0),
        }));
        return;
      }
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    return handleHttp(req, res);
  });

  const wss = new WebSocketServer({ server });

  const connections = new Set<WebSocket>();
  function broadcast(msg: IncomingFromServer): void {
    const payload = JSON.stringify(msg);
    for (const sock of connections) {
      if (sock.readyState === WebSocket.OPEN) sock.send(payload);
    }
  }

  // Mount bridge immediately so it captures events from the start
  bridge.mount(source, broadcast);

  wss.on('connection', (socket: WebSocket) => {
    connections.add(socket);
    // Update bridge's sendFn to broadcast to all connections
    bridge.mount(source, broadcast);
    bindSocket(socket, bridge, source, (spec) => {
      broadcastLensDefined(broadcast, spec);
      bridge.sendLensList();
    });
    socket.on('close', () => connections.delete(socket));
  });

  return new Promise((resolve) => {
    server.listen(port, '0.0.0.0', () => {
      console.log(`Backend (HTTP+WS) bound to 0.0.0.0:${port}
  Dev mode: Vite at http://localhost:5173 → proxies /ws and /test to :${port}
  Production: serves client from dist/; open http://0.0.0.0:${port}`);
      resolve({
        close: () => new Promise<void>((done) => wss.close(() => server.close(() => done()))),
        address: () => ({ port }),
      });
    });
  });
}

function bindSocket(
  socket: WebSocket,
  bridge: CognitiveBridge,
  source: CognitiveEventSource,
  onLensDefine?: (spec: LensSpec) => void
): void {
  let currentLens: Lens = 'belief';
  let focusTerm: string | null = null;

  bridge.mount(source, (msg: IncomingFromServer) => {
    if (socket.readyState === socket.OPEN) {
      socket.send(JSON.stringify(msg));
    }
  });

  bridge.sendInitialState();

  handleConnection(
    socket,
    bridge,
    (content, send) => onChat(content, send, source),
    (lens) => {
      currentLens = lens;
      bridge.setLens(lens);
    },
    (term) => {
      focusTerm = term;
      bridge.setFocus(term);
    },
    (spec, _send) => {
      onLensDefine?.(spec);
    }
  );

  const unsubscribe = bridge.subscribeEvents(socket, () => currentLens);
  socket.on('close', () => {
    unsubscribe();
  });
}

function broadcastLensDefined(sendFn: (msg: IncomingFromServer) => void, spec: LensSpec): void {
  sendFn({ type: 'lens.defined', lens: spec } as IncomingFromServer);
}

async function main(): Promise<void> {
   const { SeNARSFactory } = await import('@senars/nar');
   const { createAgent, createAutonomyEngine } = await import('@senars/nar/agent');
   const { DEFAULT_NAR_CONFIG } = await import('../../../src/config/index.js');

   const nar = SeNARSFactory.createDefault({ ...DEFAULT_NAR_CONFIG });

   const systemEventBus = nar.getSystemEventBus();
   const autonomyEngine = createAutonomyEngine(nar, systemEventBus);
   autonomyEngine.setNotifyHandler((msg) => console.log(`[Autonomy] ${msg}`));

   const agent = createAgent({ nar, autonomyEngine });
   agent.start();

   await agent.waitForReady();

   const server = await startWebUIWithNAR(nar, agent, { bootstrap: true });

   await autonomyEngine.requestReasoning(3);

   const shutdown = (signal: NodeJS.Signals) => {
     console.log(`Received ${signal}, shutting down UI server...`);
     server.close();
     agent.stop();
   };
   process.on('SIGINT', shutdown);
   process.on('SIGTERM', shutdown);
 }

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    process.stderr.write(`UI server failed: ${errMsg(err)}\n`);
    process.exit(1);
  });
}
