import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Agent, CognitiveEvent } from '@senars/core';
import type { GraphNodeData, IncomingFromServer } from '@senars/core';
import { WebSocketServer } from 'ws';
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
  projection?: UnifiedGraphProjection
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

  return false;
}

async function aggregateChatResponse(agent: Agent, text: string): Promise<string> {
  let response = '';
  if (typeof agent.chat === 'function') {
    for await (const evt of agent.chat(text)) {
      if (evt.kind === 'text-delta' && evt.text) response += evt.text;
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
  const seenTerms = new Set<string>();

  if (agent) {
    agent.on('*', (event: CognitiveEvent) => {
      if (event.type !== 'derivation.made') return;
      const term = event.payload.conclusion;
      if (seenTerms.has(term)) return;
      seenTerms.add(term);
      const payload = event.payload as {
        conclusion: string;
        truth?: { frequency: number; confidence: number };
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
      if (projection) {
        projection.applyDelta({ nodes: [node], edges: [] });
      }
    });
  }

  const httpServer = createServer(async (req, res) => {
    if (handleTestEndpoints(req, res, projection)) return;
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
      { type: 'config.schema', data: {} },
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

      ws.on('message', (raw) => {
        try {
          const msg = JSON.parse(raw.toString());
          if (msg.type === 'chat.user' && msg.content && agent) {
            aggregateChatResponse(agent, msg.content)
              .then((response) => {
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
              .catch(() => {
                /* ignore agent errors */
              });
          }
        } catch {
          /* malformed */
        }
      });

      ws.on('close', () => projection.unmount(sender));
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
