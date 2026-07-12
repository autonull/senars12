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

export interface StartUIOptions {
  port?: number;
  clientDist?: string;
  nar?: NAR;
  bootstrap?: boolean;
}

function defaultClientDist(): string {
  return path.join(__dirname, '..', '..', 'dist', 'client');
}

function createBroadcast(connections: Set<WebSocket>): (msg: IncomingFromServer) => void {
  return (msg) => {
    const payload = JSON.stringify(msg);
    for (const sock of connections) {
      if (sock.readyState === WebSocket.OPEN) sock.send(payload);
    }
  };
}

export async function startWebUI(
  source: CognitiveEventSource,
  options: StartUIOptions = {},
): Promise<TestServer> {
  const { port = DEFAULT_PORT, clientDist, nar, bootstrap = true } = options;
  const bridge = createCognitiveBridge(nar);
  initLensRegistry();
  const distRoot = clientDist ?? defaultClientDist();

  const handleHttp = createStaticHandler(distRoot);
  const testControlHandler = nar ? createTestControlHandler(nar) : null;

  const autonomy = nar ? withAutonomy(source).getAutonomyEngine?.() : undefined;
  autonomy?.pause();

  const server = http.createServer(async (req, res) => {
    const pathname = new URL(req.url ?? '/', `http://${req.headers.host}`).pathname;
    if (!pathname.startsWith('/test/')) {
      return handleHttp(req, res);
    }

    if (pathname === '/test/reset' && req.method === 'POST') {
      if (!nar) {
        res.writeHead(404);
        res.end('Not found');
        return;
      }
      try {
        const resetAutonomy = withAutonomy(source).getAutonomyEngine?.();
        resetAutonomy?.pause();

        bridge.reset();
        nar.clearMemory();
        await bootstrapNAR(nar);
        bridge.syncFromNAR();

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

    if (pathname === '/test/debug' && req.method === 'GET' && nar) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          bridgeConcepts: bridge.listConcepts().length,
          narConcepts: nar.listConcepts().length,
          bridgeEdges: bridge
            .listConcepts()
            .reduce((sum, c) => sum + (c.getLinks?.()?.length ?? 0), 0),
        }),
      );
      return;
    }

    res.writeHead(404);
    res.end('Not found');
  });

  const wss = new WebSocketServer({ server });
  const connections = new Set<WebSocket>();
  const broadcast = createBroadcast(connections);

  bridge.mount(source, broadcast);

  if (nar && bootstrap) {
    await bootstrapNAR(nar);
    bridge.syncFromNAR();
  }

  autonomy?.resume();

  wss.on('connection', (socket: WebSocket) => {
    connections.add(socket);
    bindSocket(socket, bridge, source, (spec) => {
      broadcast({ type: 'lens.defined', lens: spec } as IncomingFromServer);
      bridge.sendLensList();
    });
    socket.on('close', () => connections.delete(socket));
  });

  return new Promise((resolve) => {
    server.listen(port, '0.0.0.0', () => {
      const boundPort = (server.address() as { port: number } | null)?.port ?? port;
      console.log(`Backend (HTTP+WS) bound to 0.0.0.0:${boundPort}
  Dev mode: Vite at http://localhost:5173 → proxies /ws and /test to :${boundPort}
  Production: serves client from dist/; open http://0.0.0.0:${boundPort}`);
      resolve({
        close: () => new Promise<void>((done) => wss.close(() => server.close(() => done()))),
        address: () => ({ port: boundPort }),
      });
    });
  });
}

/** Compatibility wrapper: start the UI without an attached NAR. */
export async function startWebUIWithOptions(
  source: CognitiveEventSource,
  options: { port?: number; clientDist?: string } = {},
): Promise<TestServer> {
  return startWebUI(source, options);
}

/** Compatibility wrapper: start the UI with an attached NAR and bootstrap. */
export async function startWebUIWithNAR(
  nar: NAR,
  source: CognitiveEventSource,
  options: { port?: number; clientDist?: string; bootstrap?: boolean } = {},
): Promise<TestServer> {
  return startWebUI(source, { ...options, nar });
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

    const server = await startWebUI(agent, { nar, bootstrap: true });

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
