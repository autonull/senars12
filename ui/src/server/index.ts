import { createServer } from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const DIST_DIR = resolve(__dirname, '../../dist/client');
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

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

interface TestState {
  concepts: Array<{ term: string; f: number; c: number }>;
  chatHistory: Array<{ role: string; content: string }>;
  derivations: Array<{ conclusion: string; frequency: number; confidence: number }>;
  connected: boolean;
}

const testState: TestState = {
  concepts: [],
  chatHistory: [],
  derivations: [],
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

function handleTestEndpoints(req: IncomingMessage, res: ServerResponse): boolean {
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
    req.on('data', (chunk: Buffer) => { body += chunk; });
    req.on('end', () => {
      const { concepts } = JSON.parse(body);
      testState.concepts = concepts;
      res.end(JSON.stringify({ success: true, count: concepts.length }));
    });
    return true;
  }

  if (url === '/test/inject-chat' && req.method === 'POST') {
    let body = '';
    req.on('data', (chunk: Buffer) => { body += chunk; });
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
    req.on('data', (chunk: Buffer) => { body += chunk; });
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

const httpServer = createServer(async (req, res) => {
  if (handleTestEndpoints(req, res)) return;
  if (await serveStatic(req, res)) return;

  try {
    const content = await readFile(resolve(DIST_DIR, 'index.html'));
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(content);
  } catch {
    res.writeHead(404);
    res.end('Not found - run `pnpm build` first');
  }
});

const wss = new WebSocketServer({ noServer: true });

wss.on('connection', (ws) => {
  testState.connected = true;

  const handshake = [
    { type: 'config.schema', data: {} },
    { type: 'lens.fields', fields: [] },
    { type: 'lens.list', lenses: [] },
    { type: 'cognitive.delta', seqId: 0, lens: 'belief', ops: [] },
  ];

  for (const msg of handshake) {
    ws.send(JSON.stringify(msg));
  }

  if (testState.concepts.length > 0) {
    ws.send(JSON.stringify({
      type: 'cognitive.delta',
      seqId: 1,
      lens: 'belief',
      ops: testState.concepts.map((c, i) => ({
        action: 'add_node',
        id: `concept:${i}`,
        data: {
          id: `concept:${i}`,
          label: c.term,
          html: `<div>${c.term}</div>`,
          nodeType: 'nar:concept',
          priority: c.f,
          confidence: c.c,
        },
      })),
    }));
  }

  ws.on('message', (raw) => {
    try {
      const msg = JSON.parse(raw.toString());
      const type = msg.type;

      if (type === 'chat.user') {
        const content = msg.content;
        if (content) {
          testState.chatHistory.push({ role: 'user', content });
          testState.chatHistory.push({ role: 'agent', content: `Echo: ${content}` });
          ws.send(JSON.stringify({
            type: 'chat.agent.complete',
            messageId: crypto.randomUUID(),
            content: `Echo: ${content}`,
            html: `<div>Echo: ${content}</div>`,
          }));
        }
      }
    } catch {
      // malformed
    }
  });

  ws.on('close', () => {
    testState.connected = false;
  });
});

httpServer.on('upgrade', (request, socket, head) => {
  if (request.url?.startsWith('/ws')) {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  } else {
    socket.destroy();
  }
});

export interface StartUIOptions {
  port?: number;
  bootstrap?: boolean;
}

export interface TestServer {
  address(): { port: number };
  close(): Promise<void>;
}

export async function startTestServer(): Promise<TestServer> {
  return new Promise((resolve) => {
    const host = process.env.CI ? '0.0.0.0' : 'localhost';
    httpServer.listen({ port: PORT, host, reusePort: true }, () => {
      console.log(`Server running on http://${host}:${PORT}`);
      resolve({
        address: () => ({ port: PORT }),
        close: async () => {
          for (const client of wss.clients) client.terminate();
          wss.close();
          await new Promise<void>((r) => httpServer.close(() => r()));
        },
      });
    });
  });
}

export async function startAgentUI(_agent: unknown, _opts: StartUIOptions = {}): Promise<TestServer> {
  return startTestServer();
}

if (import.meta.url === `file://${process.argv[1]}`) {
  startTestServer().catch(console.error);
}