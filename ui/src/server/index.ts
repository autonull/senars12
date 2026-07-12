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

interface PauseableAutonomy {
  pause(): void;
  resume(): void;
}

interface AutonomyCapableSource extends CognitiveEventSource {
  getAutonomyEngine?(): PauseableAutonomy | undefined;
}

function withAutonomy(source: CognitiveEventSource): AutonomyCapableSource {
  return source as unknown as AutonomyCapableSource;
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_PORT = 3000;

export interface TestServer {
  close(): Promise<void>;
  address(): { port: number };
}

export async function startWebUI(source: CognitiveEventSource): Promise<TestServer> {
  const bridge = createCognitiveBridge();
  initLensRegistry();
  const distRoot = path.join(__dirname, '..', '..', 'dist', 'client');
  
  // Create HTTP server
  const handleHttp = createStaticHandler(distRoot);

  const server = http.createServer(async (req, res) => {
    const pathname = new URL(req.url ?? '/', `http://${req.headers.host}`).pathname;
    if (pathname.startsWith('/test/')) {
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

  bridge.mount(source, broadcast);

  wss.on('connection', (socket: WebSocket) => {
    connections.add(socket);
    bindSocket(socket, bridge, source);
    socket.on('close', () => connections.delete(socket));
  });

  return new Promise((resolve) => {
    server.listen(DEFAULT_PORT, '0.0.0.0', () => {
      console.log(`Backend (HTTP+WS) bound to 0.0.0.0:${DEFAULT_PORT}
  Dev mode: Vite at http://localhost:5173 \u2192 proxies /ws and /test to :${DEFAULT_PORT}
  Production: serves client from dist/; open http://0.0.0.0:${DEFAULT_PORT}`);
      resolve({
        close: () => new Promise<void>((done) => wss.close(() => server.close(() => done()))),
        address: () => ({ port: DEFAULT_PORT }),
      });
    });
  });
}

export async function startWebUIWithOptions(
  source: CognitiveEventSource,
  options: { port?: number; clientDist?: string } = {}
): Promise<TestServer> {
  const bridge = createCognitiveBridge();
  const distRoot = options.clientDist ?? path.join(__dirname, '..', '..', 'dist', 'client');
  
  const handleHttp = createStaticHandler(distRoot);

  const server = http.createServer(async (req, res) => {
    const pathname = new URL(req.url ?? '/', `http://${req.headers.host}`).pathname;
    if (pathname.startsWith('/test/')) {
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

  bridge.mount(source, broadcast);

  wss.on('connection', (socket: WebSocket) => {
    connections.add(socket);
    bindSocket(socket, bridge, source);
    socket.on('close', () => connections.delete(socket));
  });

  return new Promise((resolve) => {
    server.listen(options.port ?? DEFAULT_PORT, '0.0.0.0', () => {
      console.log(`Backend (HTTP+WS) bound to 0.0.0.0:${options.port ?? DEFAULT_PORT}
  Dev mode: Vite at http://localhost:5173 \u2192 proxies /ws and /test to :${options.port ?? DEFAULT_PORT}
  Production: serves client from dist/; open http://0.0.0.0:${options.port ?? DEFAULT_PORT}`);
      resolve({
        close: () => new Promise<void>((done) => wss.close(() => server.close(() => done()))),
        address: () => ({ port: options.port ?? DEFAULT_PORT }),
      });
    });
  });
}

export async function startWebUIWithNAR(
  nar: NAR,
  source: CognitiveEventSource,
  options: { port?: number; clientDist?: string; bootstrap?: boolean } = {}
): Promise<TestServer> {
  const bridge = createCognitiveBridge(nar);
  initLensRegistry();
  const distRoot = options.clientDist ?? path.join(__dirname, '..', '..', 'dist', 'client');

  // Create HTTP server FIRST so we have the broadcast function
  const handleHttp = createStaticHandler(distRoot);
  const testControlHandler = nar ? createTestControlHandler(nar) : null;

  // Pause autonomy engine during bootstrap to avoid flooding events
  const autonomy = withAutonomy(source).getAutonomyEngine?.();
  autonomy?.pause();

  const server = http.createServer(async (req, res) => {
    const pathname = new URL(req.url ?? '/', `http://${req.headers.host}`).pathname;
    if (pathname.startsWith('/test/')) {
      if (pathname === '/test/reset' && req.method === 'POST') {
        try {
          const resetAutonomy = withAutonomy(source).getAutonomyEngine?.();
          resetAutonomy?.pause();

          bridge.reset();
          if (nar) {
            nar.clearMemory();
            await bootstrapNAR(nar);
            bridge.syncFromNAR();
          }

          resetAutonomy?.resume();

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

  // Mount bridge NOW so it captures bootstrap events
  bridge.mount(source, broadcast);

  // Bootstrap NAR - bridge will capture events
  if (options.bootstrap !== false) {
    await bootstrapNAR(nar);
  }

  // Populate the bridge from NAR so the initial graph reflects bootstrap relations
  bridge.syncFromNAR();

  // Resume autonomy engine after bootstrap
  autonomy?.resume();

  wss.on('connection', (socket: WebSocket) => {
    connections.add(socket);
    bindSocket(socket, bridge, source, (spec) => {
      broadcastLensDefined(broadcast, spec);
      bridge.sendLensList();
    });
    socket.on('close', () => connections.delete(socket));
  });

  return new Promise((resolve) => {
    server.listen(options.port ?? DEFAULT_PORT, '0.0.0.0', () => {
      console.log(`Backend (HTTP+WS) bound to 0.0.0.0:${options.port ?? DEFAULT_PORT}
  Dev mode: Vite at http://localhost:5173 \u2192 proxies /ws and /test to :${options.port ?? DEFAULT_PORT}
  Production: serves client from dist/; open http://0.0.0.0:${options.port ?? DEFAULT_PORT}`);
      resolve({
        close: () => new Promise<void>((done) => wss.close(() => server.close(() => done()))),
        address: () => ({ port: options.port ?? DEFAULT_PORT }),
      });
    });
});
}

function broadcastLensDefined(sendFn: (msg: IncomingFromServer) => void, spec: LensSpec): void {
  sendFn({ type: 'lens.defined', lens: spec } as IncomingFromServer);
}

function bindSocket(
  socket: WebSocket,
  bridge: CognitiveBridge,
  source: CognitiveEventSource,
  onLensDefine?: (spec: LensSpec) => void
): void {
  let currentLens: Lens = 'belief';
  let focusTerm: string | null = null;

  // Bridge is already mounted with broadcast function at server start.
  // Do NOT call bridge.mount() here - it would overwrite the broadcast sendFn.
  // Just send initial state to this socket.
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
