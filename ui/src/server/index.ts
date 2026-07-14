import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocket, WebSocketServer } from 'ws';
import type { LensSpec } from '@senars/core/lens-schema';
import type { IncomingFromServer, Lens } from '@senars/core/protocol';
import type { Agent } from '@senars/core';
import { errMsg } from '@senars/nar/utils';
import { onChat } from './chat.js';
import { AgentBridge } from './agent-bridge.js';
import { UnifiedGraphProjection } from './UnifiedGraphProjection.js';
import { handleConnection, initLensRegistry } from './gateway.js';
import { createStaticHandler } from './static.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_PORT = 3000;

export interface TestServer {
  close(): Promise<void>;
  address(): { port: number };
}

export interface StartUIOptions {
  port?: number;
  clientDist?: string;
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

/**
 * Start the UI with a multi-backend Agent.
 * Uses AgentBridge (wrapping UnifiedGraphProjection) for graph projection.
 * Graph deltas flow: backends → Agent → AgentBridge → UnifiedGraphProjection → WS clients.
 */
export async function startAgentUI(
  agent: Agent,
  options: StartUIOptions = {},
): Promise<TestServer> {
  const { port = DEFAULT_PORT, clientDist } = options;

  const projection = new UnifiedGraphProjection();
  const bridge = new AgentBridge(agent, projection);
  initLensRegistry();
  const distRoot = clientDist ?? defaultClientDist();

  const handleHttp = createStaticHandler(distRoot);

  const server = http.createServer(async (req, res) => {
    const pathname = new URL(req.url ?? '/', `http://${req.headers.host}`).pathname;
    if (!pathname.startsWith('/test/')) {
      return handleHttp(req, res);
    }
    res.writeHead(404);
    res.end('Not found');
  });

  const wss = new WebSocketServer({ server });
  const connections = new Set<WebSocket>();
  const broadcast = createBroadcast(connections);

  bridge.mount(agent, broadcast);

  agent.start();

  wss.on('connection', (socket: WebSocket) => {
    connections.add(socket);
    bindSocket(socket, bridge, agent, (spec) => {
      broadcast({ type: 'lens.defined', lens: spec } as IncomingFromServer);
      bridge.sendLensList();
    });
    socket.on('close', () => connections.delete(socket));
  });

  return new Promise((resolve) => {
    server.listen(port, '0.0.0.0', () => {
      const boundPort = (server.address() as { port: number } | null)?.port ?? port;
      console.log(`Agent UI bound to 0.0.0.0:${boundPort}
  Dev mode: Vite at http://localhost:5173 → proxies /ws and /test to :${boundPort}
  Production: serves client from dist/; open http://0.0.0.0:${boundPort}`);
      resolve({
        close: () => new Promise<void>((done) => wss.close(() => server.close(() => done()))),
        address: () => ({ port: boundPort }),
      });
    });
  });
}

function bindSocket(
  socket: WebSocket,
  bridge: AgentBridge,
  source: Agent,
  onLensDefine?: (spec: LensSpec) => void,
): void {
  let currentLens: Lens = 'belief';
  let focusTerm: string | null = null;

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
    },
  );

  const unsubscribe = bridge.subscribeEvents(socket, () => currentLens);
  socket.on('close', () => {
    unsubscribe();
  });
}

async function main(): Promise<void> {
  const { Agent } = await import('@senars/core');
  const { SeNARSFactory } = await import('@senars/nar');
  const { createAgent, createAutonomyEngine } = await import('@senars/nar/agent');
  const { NarBackend } = await import('@senars/nar/backend');
  const { DEFAULT_NAR_CONFIG } = await import('../../../src/config/index.js');

  const nar = SeNARSFactory.createDefault({ ...DEFAULT_NAR_CONFIG });

  const systemEventBus = nar.getSystemEventBus();
  const autonomyEngine = createAutonomyEngine(nar, systemEventBus);
  autonomyEngine.setNotifyHandler((msg) => console.log(`[Autonomy] ${msg}`));

  const oldAgent = createAgent({ nar, autonomyEngine });
  oldAgent.start();
  await oldAgent.waitForReady();

  const agent = new Agent({ name: 'senars' });
  await agent.registerBackend(new NarBackend(oldAgent), {});
  agent.start();

  const server = await startAgentUI(agent, { bootstrap: true });

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
