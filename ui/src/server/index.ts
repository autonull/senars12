import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { type WebSocket, WebSocketServer } from 'ws';
import type { Agent } from '../../../nar/src/agent/index.js';
import type { NAR } from '../../../nar/src/nar.js';
import { errMsg } from '../../../nar/src/utils';
import type { LensSpec } from '../shared/lens-schema.js';
import type { IncomingFromServer, Lens } from '../shared/protocol.js';
import { onChat } from './chat.js';
import { type NarAdapter, handleConnection, initLensRegistry } from './gateway.js';
import { buildNarAdapter, createTelemetryEmitter } from './nar-adapter.js';
import { sendInitialState, sendLensList, broadcastLensDefined, subscribeSocket } from './socket-handler.js';
import { createStaticHandler } from './static.js';
import { createTestControlHandler } from './test-control.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_PORT = 3000;

export interface TestServer {
  close(): Promise<void>;

  address(): { port: number };
}

export async function startWebUI(nar: NAR, agent: Agent): Promise<TestServer> {
  const adapter = buildNarAdapter(nar);
  initLensRegistry();
  return startHttpServer(
    adapter,
    nar,
    agent,
    DEFAULT_PORT,
    path.join(__dirname, '..', '..', 'dist', 'client')
  );
}

export async function startWebUIWithOptions(
  nar: NAR,
  agent: Agent,
  options: { port?: number; clientDist?: string } = {}
): Promise<TestServer> {
  const adapter = buildNarAdapter(nar);
  const distRoot = options.clientDist ?? path.join(__dirname, '..', '..', 'dist', 'client');
  return startHttpServer(adapter, nar, agent, options.port ?? DEFAULT_PORT, distRoot);
}

function startHttpServer(
  adapter: NarAdapter,
  nar: NAR,
  agent: Agent,
  port: number,
  distRoot: string
): Promise<TestServer> {
  const handleTestControl = createTestControlHandler(nar);
  const handleHttp = createStaticHandler(distRoot);

  const server = http.createServer(async (req, res) => {
    const pathname = new URL(req.url ?? '/', `http://${req.headers.host}`).pathname;
    if (pathname.startsWith('/test/')) return handleTestControl(req, res, pathname);
    return handleHttp(req, res);
  });

  const wss = new WebSocketServer({ server });

  // Track all connected sockets for broadcasting
  const connections = new Set<WebSocket>();
  function broadcast(msg: IncomingFromServer): void {
    const payload = JSON.stringify(msg);
    for (const sock of connections) {
      if (sock.readyState === sock.OPEN) sock.send(payload);
    }
  }

  wss.on('connection', (socket) => {
    connections.add(socket);
    bindSocket(socket, adapter, nar, agent, (spec) => {
      broadcastLensDefined(broadcast, spec);
      sendLensList(broadcast);
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
  adapter: NarAdapter,
  nar: NAR,
  agent: Agent,
  onLensDefine?: (spec: LensSpec) => void
): void {
  let currentLens: Lens = 'belief';
  let focusTerm: string | null = null;

  sendInitialState(socket, adapter, currentLens);

  const sendMsg = (msg: any) => socket.send(JSON.stringify(msg));
  const stopTelemetry = createTelemetryEmitter(nar, sendMsg);

  handleConnection(
    socket,
    adapter,
    (content, send) => onChat(content, send, agent),
    (lens) => {
      currentLens = lens;
      sendInitialState(socket, adapter, currentLens);
    },
    (term) => {
      focusTerm = term;
    },
    (spec, _send) => {
      onLensDefine?.(spec);
    }
  );

  const unsubscribe = subscribeSocket(socket, adapter, agent, () => currentLens);
  socket.on('close', () => {
    unsubscribe();
    stopTelemetry();
  });
}

async function main(): Promise<void> {
  const { SeNARSFactory } = await import('../../../nar/src/factory.js');
  const { createAgent } = await import('../../../nar/src/agent/agent.js');
  const { DEFAULT_NAR_CONFIG } = await import('../../../src/config/index.js');

  const nar = SeNARSFactory.createDefault({ ...DEFAULT_NAR_CONFIG });
  const agent = createAgent({ nar });
  agent.start();
  const server = await startWebUI(nar, agent);

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
