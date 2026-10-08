import { readFile } from 'node:fs/promises';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { createServer } from 'node:http';
import { extname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type {
  Agent,
  CognitiveEvent,
  GraphNodeData,
  IncomingFromClient,
  IncomingFromServer,
  LensSpec,
} from '@senars/core';
import { IncomingFromClient as IncomingFromClientSchema } from '@senars/core';
import { DEFAULT_CONFIG, termParser } from '@senars/nar';
import { handleMetricsRequest } from '@senars/nar/metrics';
import { asBeliefTruth, envBool, envPositive, makeId, splitLines } from '@senars/util';
import { type RawData, WebSocket, WebSocketServer } from 'ws';
import { applyConfigField, buildConfigSchema, resetConfigFields } from './config-schema.js';
import {
  BOOTSTRAP_SCENARIO,
  loadScenario,
  scenarioById,
  scenarioIds,
  type Scenario,
} from './scenarios.js';
import { UnifiedGraphProjection } from './UnifiedGraphProjection.js';
import { dispatchGraphEvent, type ReducerContext } from './event-reducers.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const DIST_DIR = resolve(__dirname, '../../dist/client');
const DEFAULT_PORT = envPositive('PORT', 3000);
const TEST_ENDPOINTS = envBool('SENARS_TEST_ENDPOINTS', process.env.NODE_ENV !== 'production');

type Truth = { frequency: number; confidence: number };
type RevisionEntry = {
  truth: Truth;
  stampId: string;
  timestamp: number;
  source: 'input' | 'derivation' | 'revision' | 'inference';
};
type NarBelief = { term: { toString(): string }; truth: { f: number; c: number } };
type NarLike = {
  believe?: (statement: string) => Promise<void>;
  goal?: (statement: string) => Promise<void>;
  run?: (cycles: number) => unknown;
  getBeliefs?: () => NarBelief[];
  getRevisionHistory?: (term: unknown) => RevisionEntry[];
  getLMClient?: () => { provider?: string; model?: string; available?: boolean; getStats?: () => unknown };
  getLMClientStats?: () => unknown;
  getSelfAnalyzer?: () => { start?: () => void; stop?: () => void } | undefined;
  clearMemory?: () => void;
  setConfig?: (updates: Record<string, unknown>) => void;
  attentionReport?: () => { total: number };
};

const mimeTypes: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.wasm': 'application/wasm',
};

const testState = {
  concepts: [] as Array<{ term: string; f: number; c: number }>,
  chatHistory: [] as Array<{ role: string; content: string }>,
  derivations: [] as Array<{ conclusion: string; frequency: number; confidence: number }>,
  connected: false,
};

function narOf(agent?: Agent): NarLike | undefined {
  return (agent?.engines.get('nar') as { nar?: NarLike } | undefined)?.nar;
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
  res.end(JSON.stringify(body));
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk: Buffer) => {
      body += chunk;
    });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

async function readJson<T>(req: IncomingMessage): Promise<T> {
  return JSON.parse(await readBody(req)) as T;
}

function pathOf(req: IncomingMessage): string {
  return (req.url ?? '/').split('?')[0] ?? '/';
}

async function serveStatic(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  const url = pathOf(req);
  const rel = url === '/' ? 'index.html' : decodeURIComponent(url.slice(1));
  const filePath = resolve(DIST_DIR, rel);
  // A resolved path that escapes the dist root is a traversal attempt, not a file.
  if (relative(DIST_DIR, filePath).startsWith('..')) return false;
  const ext = extname(filePath);
  try {
    const content = await readFile(filePath);
    res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
    res.end(content);
    return true;
  } catch {
    return false;
  }
}

/** Server-side handles the deterministic test endpoints drive. */
type TestContext = {
  projection?: UnifiedGraphProjection;
  agent?: Agent;
  /** Clear the engine, reset the view, then reload the active scenario. */
  reloadActiveScenario: () => Promise<void>;
  /** Force the baseline scenario and reload it — parallel-isolation reset. */
  resetToBootstrap: () => Promise<void>;
  /** Clear the engine, reset the view, then load `scenario`. */
  loadNamedScenario: (scenario: Scenario) => Promise<void>;
};

async function handleTestEndpoints(
  req: IncomingMessage,
  res: ServerResponse,
  ctx: TestContext
): Promise<boolean> {
  const { projection, agent } = ctx;
  const url = pathOf(req);
  if (!TEST_ENDPOINTS || !url.startsWith('/test/')) return false;

  try {
    if (url === '/test/reset' && req.method === 'POST') {
      await ctx.reloadActiveScenario();
      sendJson(res, 200, { success: true, seq: projection?.seq ?? 0 });
      return true;
    }

    if (url === '/test/reset-all' && req.method === 'POST') {
      await ctx.resetToBootstrap();
      sendJson(res, 200, { success: true, seq: projection?.seq ?? 0 });
      return true;
    }

    if (url === '/test/scenarios' && req.method === 'GET') {
      sendJson(res, 200, { scenarios: scenarioIds() });
      return true;
    }

    if (url === '/test/scenario' && req.method === 'POST') {
      const { id } = await readJson<{ id: string }>(req);
      const scenario = scenarioById(id);
      if (!scenario) {
        sendJson(res, 404, { success: false, error: `Unknown scenario: ${id}` });
        return true;
      }
      await ctx.loadNamedScenario(scenario);
      sendJson(res, 200, { success: true, id: scenario.id });
      return true;
    }

    if (url === '/test/step' && req.method === 'POST') {
      const { cycles } = await readJson<{ cycles?: number }>(req).catch(() => ({ cycles: 1 }));
      const nar = narOf(agent);
      if (!nar?.run) {
        sendJson(res, 200, { success: false, error: 'No NAR engine with run() available' });
        return true;
      }
      nar.run(cycles ?? 1);
      sendJson(res, 200, { success: true, seq: projection?.seq ?? 0 });
      return true;
    }

    if (url === '/test/pause' && req.method === 'POST') {
      narOf(agent)?.getSelfAnalyzer?.()?.stop?.();
      sendJson(res, 200, { success: true, paused: true });
      return true;
    }

    if (url === '/test/resume' && req.method === 'POST') {
      narOf(agent)?.getSelfAnalyzer?.()?.start?.();
      sendJson(res, 200, { success: true, paused: false });
      return true;
    }

    if (url === '/test/inject-event' && req.method === 'POST') {
      // Explicitly synthetic: only a test harness may push an event the engine did
      // not produce. Labelled `synthetic` so it can never be mistaken for real state.
      const { event } = await readJson<{ event: CognitiveEvent }>(req);
      if (!agent || !event || typeof event.type !== 'string') {
        sendJson(res, 400, { success: false, error: 'An event with a string `type` is required' });
        return true;
      }
      agent.emitCognitive({ ...event, synthetic: true } as unknown as CognitiveEvent);
      sendJson(res, 200, { success: true });
      return true;
    }

    if (url === '/test/seed-graph' && req.method === 'POST') {
      const { concepts } = await readJson<{ concepts: typeof testState.concepts }>(req);
      testState.concepts = concepts;
      if (projection) {
        const nodes: GraphNodeData[] = concepts.map((c, i) => ({
          id: `concept:${i}`,
          term: c.term,
          label: c.term,
          nodeType: 'nar:concept',
          priority: c.f,
          confidence: c.c,
        }));
        projection.applyDelta({ nodes, edges: [] });
      }
      sendJson(res, 200, { success: true, count: concepts.length });
      return true;
    }

    if (url === '/test/inject-chat' && req.method === 'POST') {
      const { stream, complete } = await readJson<{ stream: string; complete: string }>(req);
      testState.chatHistory.push({ role: 'user', content: stream });
      testState.chatHistory.push({ role: 'agent', content: complete });
      sendJson(res, 200, { success: true });
      return true;
    }

    if (url === '/test/inject-derivation' && req.method === 'POST') {
      const { conclusion, frequency, confidence } = await readJson<{
        conclusion: string;
        frequency?: number;
        confidence?: number;
      }>(req);
      testState.derivations.push({
        conclusion,
        frequency: frequency ?? 0.85,
        confidence: confidence ?? 0.9,
      });
      projection?.applyDelta({
        nodes: [
          {
            id: conclusion,
            term: conclusion,
            label: conclusion,
            nodeType: 'nar:concept',
            priority: frequency ?? 0.85,
            confidence: confidence ?? 0.9,
          },
        ],
        edges: [],
      });
      sendJson(res, 200, { success: true });
      return true;
    }

    if (url === '/test/pre-bootstrap' && req.method === 'POST') {
      testState.connected = true;
      sendJson(res, 200, { success: true });
      return true;
    }

    if (url === '/test/state' && req.method === 'GET') {
      sendJson(res, 200, testState);
      return true;
    }

    if (url === '/test/session-save' && req.method === 'POST') {
      if (!agent?.sessionManager) {
        sendJson(res, 200, { success: false, error: 'No session manager' });
        return true;
      }
      agent.sessionManager
        .snapshot()
        .then(() => sendJson(res, 200, { success: true }))
        .catch((e: Error) => sendJson(res, 200, { success: false, error: e.message }));
      return true;
    }

    if (url === '/test/session-load' && req.method === 'POST') {
      if (!agent?.sessionManager) {
        sendJson(res, 200, { success: false, error: 'No session manager' });
        return true;
      }
      agent.sessionManager
        .restore()
        .then(() => sendJson(res, 200, { success: true }))
        .catch((e: Error) => sendJson(res, 200, { success: false, error: e.message }));
      return true;
    }

    if (url === '/test/import-beliefs' && req.method === 'POST') {
      const { statements, narsese } = await readJson<{ statements?: string[]; narsese?: string }>(req);
      const lines = statements ?? splitLines(narsese ?? '');
      const nar = narOf(agent);
      if (!nar?.believe || !nar.run) {
        sendJson(res, 200, { success: false, error: 'No NAR engine with believe() available' });
        return true;
      }
      for (const stmt of lines) {
        await nar.believe(stmt);
        nar.run(3);
      }
      sendJson(res, 200, { success: true, count: lines.length });
      return true;
    }

    if (url === '/test/export-beliefs' && req.method === 'GET') {
      const beliefs = narOf(agent)?.getBeliefs?.() ?? [];
      sendJson(res, 200, {
        beliefs: beliefs.map((b) => ({ term: b.term.toString(), truth: asBeliefTruth(b.truth) })),
        count: beliefs.length,
      });
      return true;
    }
  } catch (e: unknown) {
    sendJson(res, 400, { success: false, error: (e as Error).message });
    return true;
  }

  return false;
}

async function aggregateChatResponse(agent: Agent, text: string, ws?: WebSocket): Promise<string> {
  let response = '';
  if (typeof agent.chat !== 'function') return response;
  for await (const evt of agent.chat(text)) {
    if (evt.kind !== 'text-delta' || !evt.text) continue;
    response += evt.text;
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'chat.agent.stream', delta: evt.text }));
    }
  }
  return response;
}

function createServerWithProjection(agent?: Agent): {
  server: ReturnType<typeof createServer>;
  projection?: UnifiedGraphProjection;
  wss: WebSocketServer;
} {
  const projection = agent ? new UnifiedGraphProjection() : undefined;
  const currentNarConfig = { ...DEFAULT_CONFIG };
  const nar = () => narOf(agent);
  let activeScenario: Scenario | undefined = agent ? BOOTSTRAP_SCENARIO : undefined;
  let derivationsWindow = 0;
  const lastTelemetryAt = { t: Date.now() };

  if (agent && projection) {
    const reducerCtx: ReducerContext = {
      projection,
      beliefs: () => nar()?.getBeliefs?.() ?? [],
    };
    agent.on('*', (event: CognitiveEvent) => {
      if (event.type === 'derivation.made') derivationsWindow++;
      dispatchGraphEvent(event, reducerCtx);
    });
  }

  const httpServer = createServer(async (req, res) => {
    const url = pathOf(req);
    if (await handleMetricsRequest(req, res)) return;
    if (url === '/health' || url === '/ready') {
      sendJson(res, 200, { status: 'ok', ready: true, agent: !!agent });
      return;
    }
    if (await handleTestEndpoints(req, res, makeTestContext())) return;
    if (await serveStatic(req, res)) return;
    try {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(await readFile(resolve(DIST_DIR, 'index.html')));
    } catch {
      res.writeHead(404);
      res.end('Not found — run `pnpm build` first');
    }
  });

  const wss = new WebSocketServer({ noServer: true });
  const pingSentAt = new Map<WebSocket, number>();
  const latency = new Map<WebSocket, number>();

  function clearTestState(): void {
    testState.concepts = [];
    testState.chatHistory = [];
    testState.derivations = [];
    testState.connected = false;
  }

  function resetView(): void {
    projection?.reset();
    clearTestState();
    derivationsWindow = 0;
    lastTelemetryAt.t = Date.now();
    latency.clear();
  }

  async function applyScenario(scenario: Scenario, clearEngine = true): Promise<void> {
    activeScenario = scenario;
    if (clearEngine) nar()?.clearMemory?.();
    resetView();
    const engine = nar();
    if (engine) await loadScenario(engine, scenario);
  }

  const reloadActiveScenario = async (): Promise<void> => {
    resetView();
    if (activeScenario) await applyScenario(activeScenario);
  };

  const makeTestContext = (): TestContext => ({
    projection,
    agent,
    reloadActiveScenario,
    resetToBootstrap: async () => {
      if (agent) await applyScenario(BOOTSTRAP_SCENARIO);
      else resetView();
    },
    loadNamedScenario: (scenario) => applyScenario(scenario),
  });

  function errorFrame(
    code: 'invalid_message' | 'not_available' | 'internal',
    message: string,
    context?: Record<string, unknown>
  ): IncomingFromServer {
    return { type: 'server.error', code, message, context };
  }

  function sendStateSnapshot(ws: WebSocket): void {
    if (!projection || ws.readyState !== WebSocket.OPEN) return;
    ws.send(
      JSON.stringify({
        type: 'state.snapshot',
        seqId: projection.seq,
        data: {
          graph: projection.graphSnapshot(),
          workingMemory: nar()?.getBeliefs?.().map((b) => b.term.toString()) ?? [],
          config: buildConfigSchema(currentNarConfig),
        },
      })
    );
  }

  function sendNodeHistory(ws: WebSocket, term: string): void {
    let history: RevisionEntry[] = [];
    try {
      history = nar()?.getRevisionHistory?.(termParser.parse(term)) ?? [];
    } catch {
      history = [];
    }
    if (ws.readyState !== WebSocket.OPEN) return;
    ws.send(
      JSON.stringify({
        type: 'node.history',
        term,
        history: history.map(({ truth, stampId, timestamp, source }) => ({
          truth,
          stampId,
          timestamp,
          source,
        })),
      })
    );
  }

  function sendLmStatus(ws: WebSocket): void {
    const lm = nar()?.getLMClient?.() ?? {};
    if (ws.readyState !== WebSocket.OPEN) return;
    ws.send(
      JSON.stringify({
        type: 'lm.status',
        data: {
          provider: lm.provider ?? 'none',
          model: lm.model,
          available: lm.available ?? false,
          stats: typeof lm.getStats === 'function' ? lm.getStats() : {},
        },
      })
    );
  }

  function broadcastConfigSchema(): void {
    const schema = buildConfigSchema(currentNarConfig);
    for (const client of wss.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({ type: 'config.schema', data: schema }));
      }
    }
  }

  function applyConfigUpdates(updates: Partial<typeof currentNarConfig>): void {
    const engine = nar();
    if (!engine?.setConfig) return;
    engine.setConfig(updates);
    Object.assign(currentNarConfig, updates);
    broadcastConfigSchema();
  }

  function handleClientMessage(ws: WebSocket, msg: IncomingFromClient): void {
    switch (msg.type) {
      case 'chat.user':
        if (!agent) return;
        aggregateChatResponse(agent, msg.content, ws)
          .then((response) => {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(
                JSON.stringify({ type: 'chat.agent.complete', messageId: makeId(), content: response })
              );
            }
          })
          .catch((e: unknown) => {
            ws.send(JSON.stringify(errorFrame('internal', (e as Error).message)));
          });
        return;
      case 'config.set': {
        const updates = applyConfigField(msg.key, msg.value);
        if (updates) applyConfigUpdates(updates);
        return;
      }
      case 'config.reset':
        applyConfigUpdates(resetConfigFields(msg.category));
        return;
      case 'sync.request':
        sendStateSnapshot(ws);
        return;
      case 'lens.set':
        projection?.setLens(msg.lens);
        return;
      case 'focus.set':
        projection?.setFocus(msg.term);
        return;
      case 'viewport.set':
        return;
      case 'object.set':
        projection?.applyObjectPatch(msg.kind, msg.id, msg.patch);
        return;
      case 'node.set':
        projection?.applyObjectPatch('node', msg.id, msg.patch);
        return;
      case 'lens.define':
        projection?.defineLens(msg.lens as LensSpec);
        return;
      case 'node.history.request':
        sendNodeHistory(ws, msg.term);
        return;
      case 'lm.status.request':
        sendLmStatus(ws);
        return;
      case 'lm.switch':
        nar()?.setConfig?.({ lm: { provider: msg.provider } });
        return;
    }
  }

  wss.on('connection', (ws: WebSocket) => {
    ws.send(JSON.stringify({ type: 'config.schema', data: buildConfigSchema(currentNarConfig) }));

    if (projection) {
      const sender = (msg: IncomingFromServer) => {
        if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
      };
      projection.mount(sender);
      projection.sendInitialState();

      ws.on('pong', () => {
        const sent = pingSentAt.get(ws);
        if (sent) latency.set(ws, Date.now() - sent);
      });
      ws.on('error', (e: Error) => {
        console.error('[WS] Connection error:', e.message);
      });
      ws.on('message', (raw: RawData) => {
        const text = raw.toString();
        if (text === 'ping') {
          ws.send('pong');
          return;
        }
        let json: unknown;
        try {
          json = JSON.parse(text);
        } catch {
          ws.send(JSON.stringify(errorFrame('invalid_message', 'Malformed JSON')));
          return;
        }
        const parsed = IncomingFromClientSchema.safeParse(json);
        if (!parsed.success) {
          ws.send(
            JSON.stringify(
              errorFrame('invalid_message', 'Message failed protocol validation', {
                issues: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`),
              })
            )
          );
          return;
        }
        handleClientMessage(ws, parsed.data);
      });
      ws.on('close', () => {
        projection.unmount(sender);
        pingSentAt.delete(ws);
        latency.delete(ws);
      });
    } else {
      testState.connected = true;
      if (testState.concepts.length > 0) {
        ws.send(
          JSON.stringify({
            type: 'cognitive.delta',
            seqId: 1,
            lens: 'belief',
            ops: testState.concepts.map((c, i) => ({
              action: 'add_node',
              id: `concept:${i}`,
              data: {
                id: `concept:${i}`,
                label: c.term,
                nodeType: 'nar:concept',
                priority: c.f,
                confidence: c.c,
              },
            })),
          })
        );
      }
      ws.on('message', (raw: RawData) => {
        if (raw.toString() === 'ping') {
          ws.send('pong');
          return;
        }
        try {
          const msg = JSON.parse(raw.toString());
          if (msg.type === 'chat.user' && msg.content) {
            testState.chatHistory.push({ role: 'user', content: msg.content });
            testState.chatHistory.push({ role: 'agent', content: `Echo: ${msg.content}` });
            ws.send(
              JSON.stringify({
                type: 'chat.agent.complete',
                messageId: makeId(),
                content: `Echo: ${msg.content}`,
              })
            );
          }
        } catch {
          /* malformed */
        }
      });
      ws.on('close', () => {
        testState.connected = false;
      });
    }
  });

  const telemetryTimer = setInterval(() => {
    const now = Date.now();
    const elapsed = Math.max((now - lastTelemetryAt.t) / 1000, 0.001);
    const reasoningHz = derivationsWindow / elapsed;
    derivationsWindow = 0;
    lastTelemetryAt.t = now;
    const snapshot = projection?.graphSnapshot();
    const cognitive = snapshot
      ? {
          activeConcepts: snapshot.nodes.length,
          totalConcepts: nar()?.attentionReport?.().total ?? snapshot.nodes.length,
          derivationsPerSec: reasoningHz,
          contradictionCount: snapshot.nodes.filter((n) => n.isContradiction).length,
          workingMemorySize: nar()?.getBeliefs?.().length ?? 0,
        }
      : undefined;
    for (const client of wss.clients) {
      if (client.readyState !== WebSocket.OPEN) continue;
      client.ping();
      pingSentAt.set(client, now);
      client.send(
        JSON.stringify({
          type: 'telemetry',
          metrics: {
            reasoning_hz: reasoningHz,
            tokens_per_sec: 0,
            memory_mb: Math.round(process.memoryUsage().rss / 1048576),
            ws_latency_ms: latency.get(client) ?? 0,
          },
          cognitive,
        })
      );
    }
  }, 1000);

  httpServer.on('upgrade', (request, socket, head) => {
    if (request.url?.startsWith('/ws') || request.url === '/') {
      wss.handleUpgrade(request, socket, head, (ws) => wss.emit('connection', ws, request));
    } else {
      socket.destroy();
    }
  });

  httpServer.on('close', () => clearInterval(telemetryTimer));

  return { server: httpServer, projection, wss };
}

export interface StartUIOptions {
  port?: number;
  bootstrap?: boolean;
}

export interface TestServer {
  address(): { port: number };

  close(): Promise<void>;
}

export async function startUI(agent?: Agent, opts: StartUIOptions = {}): Promise<TestServer> {
  const port = opts.port ?? DEFAULT_PORT;
  return new Promise((resolve) => {
    const { server, projection, wss } = createServerWithProjection(agent);
    const host = envBool('CI') ? '0.0.0.0' : 'localhost';
    server.listen({ port, host, reusePort: true }, () => {
      const addr = server.address();
      const actualPort = addr && typeof addr === 'object' ? addr.port : port;
      console.log(`${agent ? 'Agent UI' : 'Test server'} running on http://${host}:${actualPort}`);
      resolve({
        address: () => ({ port: actualPort }),
        close: async () => {
          if (projection) {
            projection.unmount();
          }
          for (const client of wss.clients) client.terminate();
          wss.close();
          await new Promise<void>((r) => server.close(() => r()));
        },
      });
    });
  });
}

export async function startTestServer(): Promise<TestServer> {
  return startUI();
}

export async function startAgentUI(agent: Agent, opts: StartUIOptions = {}): Promise<TestServer> {
  return startUI(agent, opts);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  startTestServer().catch(console.error);
}
