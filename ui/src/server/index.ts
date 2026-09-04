import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { createServer } from 'node:http';
import { extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Agent, CognitiveEvent, GraphNodeData, IncomingFromServer } from '@senars/core';
import { isNarsese } from '@senars/core';
import { DEFAULT_CONFIG, parseTermToEdges, termParser } from '@senars/nar';
import { WebSocketServer } from 'ws';
import { applyConfigField, buildConfigSchema } from './config-schema.js';
import { UnifiedGraphProjection } from './UnifiedGraphProjection.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const DIST_DIR = resolve(__dirname, '../../dist/client');
const DEFAULT_PORT = process.env.PORT ? Number.parseInt(process.env.PORT, 10) : 3000;

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

async function serveStatic(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  const url = req.url || '/';
  const filePath = resolve(DIST_DIR, url === '/' ? 'index.html' : url.slice(1));
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

function handleTestEndpoints(
  req: IncomingMessage,
  res: ServerResponse,
  projection?: UnifiedGraphProjection,
  agent?: Agent
): boolean {
  const url = req.url || '';
  if (!url.startsWith('/test/')) return false;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (url === '/test/reset' && req.method === 'POST') {
    testState.concepts = [];
    testState.chatHistory = [];
    testState.derivations = [];
    testState.connected = false;
    res.end(JSON.stringify({ success: true }));
    return true;
  }

  if (url === '/test/seed-graph' && req.method === 'POST') {
    let body = '';
    req.on('data', (chunk: Buffer) => {
      body += chunk;
    });
    req.on('end', () => {
      const { concepts } = JSON.parse(body);
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
      res.end(JSON.stringify({ success: true, count: concepts.length }));
    });
    return true;
  }

  if (url === '/test/inject-chat' && req.method === 'POST') {
    let body = '';
    req.on('data', (chunk: Buffer) => {
      body += chunk;
    });
    req.on('end', () => {
      const { stream, complete } = JSON.parse(body);
      testState.chatHistory.push({ role: 'user', content: stream });
      testState.chatHistory.push({ role: 'agent', content: complete });
      res.end(JSON.stringify({ success: true }));
    });
    return true;
  }

  if (url === '/test/inject-derivation' && req.method === 'POST') {
    let body = '';
    req.on('data', (chunk: Buffer) => {
      body += chunk;
    });
    req.on('end', () => {
      const { conclusion, frequency, confidence } = JSON.parse(body);
      testState.derivations.push({ conclusion, frequency, confidence });
      if (projection) {
        projection.applyDelta({
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
      }
      res.end(JSON.stringify({ success: true }));
    });
    return true;
  }

  if (url === '/test/pre-bootstrap' && req.method === 'POST') {
    testState.connected = true;
    res.end(JSON.stringify({ success: true }));
    return true;
  }

  if (url === '/test/state' && req.method === 'GET') {
    res.end(JSON.stringify(testState));
    return true;
  }

  if (url === '/test/session-save' && req.method === 'POST') {
    if (agent?.sessionManager) {
      agent.sessionManager
        .snapshot()
        .then(() => res.end(JSON.stringify({ success: true })))
        .catch((e: Error) => res.end(JSON.stringify({ success: false, error: e.message })));
    } else {
      res.end(JSON.stringify({ success: false, error: 'No session manager' }));
    }
    return true;
  }

  if (url === '/test/session-load' && req.method === 'POST') {
    if (agent?.sessionManager) {
      agent.sessionManager
        .restore()
        .then(() => res.end(JSON.stringify({ success: true })))
        .catch((e: Error) => res.end(JSON.stringify({ success: false, error: e.message })));
    } else {
      res.end(JSON.stringify({ success: false, error: 'No session manager' }));
    }
    return true;
  }

  if (url === '/test/import-beliefs' && req.method === 'POST') {
    let body = '';
    req.on('data', (chunk: Buffer) => {
      body += chunk;
    });
    req.on('end', async () => {
      try {
        const { statements } = JSON.parse(body) as { statements?: string[]; narsese?: string };
        const lines =
          statements ??
          (JSON.parse(body) as { narsese: string }).narsese
            .split('\n')
            .map((s) => s.trim())
            .filter(Boolean);
        const narEngine = agent?.engines.get('nar') as
          | { nar?: { believe: (s: string) => Promise<void>; run: (n: number) => void } }
          | undefined;
        if (!narEngine?.nar?.believe) {
          res.end(
            JSON.stringify({ success: false, error: 'No NAR engine with believe() available' })
          );
          return;
        }
        for (const stmt of lines) {
          await narEngine.nar.believe(stmt);
          narEngine.nar.run(3);
        }
        res.end(JSON.stringify({ success: true, count: lines.length }));
      } catch (e: unknown) {
        res.end(JSON.stringify({ success: false, error: (e as Error).message }));
      }
    });
    return true;
  }

  if (url === '/test/export-beliefs' && req.method === 'GET') {
    try {
      const narEngine = agent?.engines.get('nar') as
        | {
            nar?: {
              getBeliefs?: () => Array<{
                term: { toString(): string };
                truth: { frequency: number; confidence: number };
              }>;
            };
          }
        | undefined;
      const beliefs = narEngine?.nar?.getBeliefs?.() ?? [];
      const result = beliefs.map((b) => ({
        term: b.term.toString(),
        truth: { frequency: b.truth.frequency, confidence: b.truth.confidence },
      }));
      res.end(JSON.stringify({ beliefs: result, count: result.length }));
    } catch (e: unknown) {
      res.end(JSON.stringify({ success: false, error: (e as Error).message }));
    }
    return true;
  }

  return false;
}

async function aggregateChatResponse(agent: Agent, text: string): Promise<string> {
  console.log('[aggregateChatResponse] Called with:', text);
  let response = '';
  if (typeof agent.chat === 'function') {
    console.log('[aggregateChatResponse] Calling agent.chat...');
    for await (const evt of agent.chat(text)) {
      console.log('[aggregateChatResponse] Got event:', evt.kind);
      if (evt.kind === 'text-delta' && evt.text) response += evt.text;
    }
    console.log('[aggregateChatResponse] Done, response:', response);
  }
  return response;
}

function createServerWithProjection(agent?: Agent): {
  server: ReturnType<typeof createServer>;
  projection?: UnifiedGraphProjection;
  wss: WebSocketServer;
} {
  const projection = agent ? new UnifiedGraphProjection() : undefined;
  const seenTerms = new Set<string>();
  const currentNarConfig = { ...DEFAULT_CONFIG };

  if (agent) {
    agent.on('*', (event: CognitiveEvent) => {
      console.log(
        '[Server] Agent event:',
        event.type,
        event.engine,
        event.payload?.conclusion ?? ''
      );
      if (event.type !== 'derivation.made') return;
      const term = event.payload.conclusion;
      if (seenTerms.has(term)) return;
      seenTerms.add(term);
      const payload = event.payload as {
        conclusion: string;
        truth?: { frequency: number; confidence: number };
        premises?: string[];
      };
      const node: GraphNodeData = {
        id: term,
        term,
        label: term,
        nodeType: 'nar:concept',
        priority: 0.7,
        confidence: 0.9,
        truth: payload.truth,
      };

      const edges: Array<{
        source: string;
        target: string;
        type: string;
        weight?: number;
        directed?: boolean;
      }> = [];

      if (isNarsese(term)) {
        try {
          const parsedTerm = termParser.parse(term);
          const termEdges = parseTermToEdges(parsedTerm);
          for (const te of termEdges) {
            edges.push({
              source: te.source,
              target: te.target,
              type: te.type,
              weight: te.weight,
              directed: te.directed,
            });
          }
        } catch {
          console.warn('[Server] Failed to parse Narsese term for edges:', term);
        }
      }

      if (payload.premises) {
        for (const premise of payload.premises) {
          edges.push({
            source: premise,
            target: term,
            type: 'derivation',
            weight: 1.0,
            directed: true,
          });
        }
      }

      if (projection) {
        projection.applyDelta({ nodes: [node], edges });
      }
    });
  }

  const httpServer = createServer(async (req, res) => {
    if (handleTestEndpoints(req, res, projection, agent)) return;
    if (await serveStatic(req, res)) return;
    try {
      const content = await readFile(resolve(DIST_DIR, 'index.html'));
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(content);
    } catch {
      res.writeHead(404);
      res.end('Not found — run `pnpm build` first');
    }
  });

  const wss = new WebSocketServer({ noServer: true });

  wss.on('connection', (ws) => {
    for (const msg of [
      { type: 'config.schema', data: buildConfigSchema(currentNarConfig) },
      { type: 'lens.fields', fields: [] },
      { type: 'lens.list', lenses: [] },
    ])
      ws.send(JSON.stringify(msg));

    if (projection) {
      const sender = (msg: IncomingFromServer) => {
        if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg));
      };
      projection.mount(sender);
      projection.sendInitialState();

      ws.on('error', (e) => {
        console.error('[WS] Connection error:', e);
      });

      ws.on('message', (raw) => {
        try {
          const msg = JSON.parse(raw.toString());
          console.log('[WS] Received message:', msg.type);
          if (msg.type === 'chat.user' && msg.content && agent) {
            console.log('[WS] Calling aggregateChatResponse...');
            aggregateChatResponse(agent, msg.content)
              .then((response) => {
                console.log('[WS] Got response:', response);
                if (ws.readyState === ws.OPEN) {
                  ws.send(
                    JSON.stringify({
                      type: 'chat.agent.complete',
                      messageId: randomUUID(),
                      content: response,
                    })
                  );
                }
              })
              .catch((e) => {
                console.error('[WS] Error in aggregateChatResponse:', e);
              });
          }

          if (msg.type === 'config.set' && agent) {
            try {
              const narEngine = agent.engines.get('nar') as
                | { nar?: { setConfig: (u: Record<string, unknown>) => void } }
                | undefined;
              if (narEngine?.nar?.setConfig) {
                const updates = applyConfigField(msg.key, msg.value);
                if (updates) {
                  narEngine.nar.setConfig(updates);
                  Object.assign(currentNarConfig, updates);
                  const schema = buildConfigSchema(currentNarConfig);
                  for (const client of wss.clients) {
                    if (client.readyState === client.OPEN) {
                      client.send(JSON.stringify({ type: 'config.schema', data: schema }));
                    }
                  }
                }
              }
            } catch (e) {
              console.error('[WS] Error applying config.set:', e);
            }
          }
        } catch (e) {
          console.error('[WS] Parse error:', e);
        }
      });

      ws.on('close', () => {
        console.log('[WS] Connection closed');
        projection.unmount(sender);
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
      ws.on('message', (raw) => {
        try {
          const msg = JSON.parse(raw.toString());
          if (msg.type === 'chat.user' && msg.content) {
            testState.chatHistory.push({ role: 'user', content: msg.content });
            testState.chatHistory.push({ role: 'agent', content: `Echo: ${msg.content}` });
            ws.send(
              JSON.stringify({
                type: 'chat.agent.complete',
                messageId: randomUUID(),
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

  httpServer.on('upgrade', (request, socket, head) => {
    if (request.url?.startsWith('/ws') || request.url === '/') {
      wss.handleUpgrade(request, socket, head, (ws) => wss.emit('connection', ws, request));
    } else {
      socket.destroy();
    }
  });

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
    const host = process.env.CI ? '0.0.0.0' : 'localhost';
    server.listen({ port, host, reusePort: true }, () => {
      const actualPort =
        server.address() && typeof server.address() === 'object' ? server.address().port : port;
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
