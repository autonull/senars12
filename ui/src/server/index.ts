import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { CognitiveEventSource } from '@senars/core';
import { errMsg } from '@senars/nar/utils';
import { WebSocket, WebSocketServer } from 'ws';
import type { LensSpec } from '../shared/lens-schema.js';
import type { IncomingFromServer, Lens } from '../shared/protocol.js';
import { onChat } from './chat.js';
import { type CognitiveBridge, createCognitiveBridge } from './cognitive-bridge.js';
import { handleConnection, initLensRegistry } from './gateway.js';
import { createStaticHandler } from './static.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_PORT = 3000;

export interface TestServer {
  close(): Promise<void>;
  address(): { port: number };
}

export async function startWebUI(source: CognitiveEventSource): Promise<TestServer> {
  const bridge = createCognitiveBridge();
  initLensRegistry();
  return startHttpServer(
    bridge,
    source,
    DEFAULT_PORT,
    path.join(__dirname, '..', '..', 'dist', 'client')
  );
}

export async function startWebUIWithOptions(
  source: CognitiveEventSource,
  options: { port?: number; clientDist?: string } = {}
): Promise<TestServer> {
  const bridge = createCognitiveBridge();
  const distRoot = options.clientDist ?? path.join(__dirname, '..', '..', 'dist', 'client');
  return startHttpServer(bridge, source, options.port ?? DEFAULT_PORT, distRoot);
}

function startHttpServer(
  bridge: CognitiveBridge,
  source: CognitiveEventSource,
  port: number,
  distRoot: string
): Promise<TestServer> {
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

  wss.on('connection', (socket: WebSocket) => {
    connections.add(socket);
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
  const { SeNARSFactory } = await import('../../../nar/src/factory.js');
  const { createAgent } = await import('../../../nar/src/agent/agent.js');
  const { DEFAULT_NAR_CONFIG } = await import('../../../src/config/index.js');

  const nar = SeNARSFactory.createDefault({ ...DEFAULT_NAR_CONFIG });
  const agent = createAgent({ nar });
  agent.start();
  const server = await startWebUI(agent);

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
