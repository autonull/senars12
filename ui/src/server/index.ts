import path from 'path';
import { fileURLToPath } from 'url';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { fileURLToPath as fileURLToPathImport } from 'url';
import type { Agent } from '../../../src/agent/types.js';
import type { NAR } from '../../../src/nar/nar.js';
import { handleConnection, type NarAdapter, consumePendingChatResponse } from './gateway.js';
import { computeActiveSubgraph } from './projection.js';
import type { IncomingFromServer } from '../shared/protocol.js';
import { registerTestControl } from './test-control.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const configState: Record<string, any> = {
  'llm.temperature': { type: 'slider', label: 'LLM Temperature', value: 0.7, min: 0, max: 2, step: 0.1 },
  'nars.revision_rate': { type: 'slider', label: 'NARS Revision Rate', value: 0.5, min: 0, max: 1, step: 0.1 },
  'nars.max_concepts': { type: 'text', label: 'Max Concepts', value: '1000' },
};

function buildNarAdapter(nar: NAR): NarAdapter {
  return {
    listConcepts() {
      return nar.listConcepts().map((c: any) => ({
        term: c.term.toString(),
        priority: c.priority ?? 0.5,
        confidence: c.confidence ?? 0.9,
        getLinks() {
          return c.getLinks().map((l: any) => ({
            target: l.concept.term.toString(),
            strength: l.strength ?? 0.5,
          }));
        },
      }));
    },
    getSystemEventBus() {
      return nar.getSystemEventBus();
    },
    attentionReport() {
      const report = nar.attentionReport();
      return { concepts: report.concepts.map((c: any) => ({ term: c.term, priority: c.priority })) };
    },
    getDriveManager(): ReturnType<NarAdapter['getDriveManager']> {
      const dm = nar.getDriveManager?.();
      if (!dm) return undefined;
      return {
        getAllStates() {
          return dm.getAllStates().map((d: any) => ({
            spec: { id: String(d.spec.id), name: String(d.spec.name) },
            currentIntensity: Number(d.currentIntensity),
            isActive: Boolean(d.isActive),
          }));
        },
      };
    },
    getConfigSchema() {
      return configState;
    },
    setConfig(key: string, value: any) {
      if (key in configState) {
        configState[key] = { ...configState[key], value };
      }
    },
  };
}

async function onChat(content: string, send: (msg: IncomingFromServer) => void, agent: Agent) {
  const pending = consumePendingChatResponse();
  if (pending) {
    if (pending.stream) send({ type: 'chat.agent.stream', delta: pending.stream });
    if (pending.complete) send({ type: 'chat.agent.complete', content: pending.complete });
    return;
  }

  try {
    const stream = agent.chat(content, { stream: true });
    for await (const event of stream) {
      if (event.kind === 'text-delta') {
        send({ type: 'chat.agent.stream', delta: event.text ?? '' });
      } else if (event.kind === 'finish') {
        send({ type: 'chat.agent.complete', content: event.text ?? '' });
      } else if (event.kind === 'error') {
        send({ type: 'chat.agent.complete', content: `Error: ${event.error}` });
      }
    }
  } catch (e) {
    send({ type: 'chat.agent.complete', content: `Error: ${e instanceof Error ? e.message : String(e)}` });
  }
}

async function serveStaticFile(req: http.IncomingMessage, res: http.ServerResponse, filePath: string) {
  const fs = await import('fs');
  const mime = await import('mime-types');
  
  const fullPath = path.join(__dirname, '../../dist/client', filePath);
  
  fs.readFile(fullPath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    const contentType = mime.lookup(filePath) || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
}

async function handleHttpRequest(req: http.IncomingMessage, res: http.ServerResponse) {
  const url = new URL(req.url || '/', `http://${req.headers.host}`);
  const pathname = url.pathname;

  // Test control API routes
  if (pathname.startsWith('/test/')) {
    return testControlHandler(req, res, pathname);
  }

  // Static files
  if (pathname === '/' || pathname === '/index.html') {
    return await serveStaticFile(req, res, 'index.html');
  }

  // Other static files
  const filePath = pathname.slice(1);
  const fullPath = path.join(__dirname, '../../dist/client', filePath);
  const fs = await import('fs');
  fs.access(fullPath, fs.constants.F_OK, (err) => {
    if (!err) {
      serveStaticFile(req, res, filePath);
    } else {
      // SPA fallback
      serveStaticFile(req, res, 'index.html');
    }
  });
}

let testControlHandler: (req: http.IncomingMessage, res: http.ServerResponse, pathname: string) => void;

function createTestControlHandler(fastifyLike: any) {
  return (req: http.IncomingMessage, res: http.ServerResponse, pathname: string) => {
    // Parse body
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const parsedBody = body ? JSON.parse(body) : {};
        const method = req.method || 'GET';
        
        // Mock fastify-like request/reply
        const mockReq = { body: parsedBody, method, url: pathname, headers: req.headers };
        const mockReply = {
          status: (code: number) => ({ send: (data: any) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(data)); } }),
          send: (data: any) => { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(data)); }
        };
        
        // Call the test control handlers
        if (pathname === '/test/seed-graph' && method === 'POST') {
          fastifyLike.seedGraph(mockReq, mockReply);
        } else if (pathname === '/test/inject-chat' && method === 'POST') {
          fastifyLike.injectChat(mockReq, mockReply);
        } else if (pathname === '/test/inject-derivation' && method === 'POST') {
          fastifyLike.injectDerivation(mockReq, mockReply);
        } else if (pathname === '/test/state' && method === 'GET') {
          fastifyLike.getState(mockReq, mockReply);
        } else if (pathname === '/test/reset' && method === 'POST') {
          fastifyLike.reset(mockReq, mockReply);
        } else {
          res.writeHead(404);
          res.end('Not found');
        }
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: String(e) }));
      }
    });
  };
}

export interface TestServer {
  close(): Promise<void>;
  address(): { port: number };
}

export async function startWebUI(nar: NAR, agent: Agent): Promise<TestServer> {
  const narAdapter = buildNarAdapter(nar);
  
  // Create test control handlers
  const testControlApi = createTestControlApi(nar, agent);
  testControlHandler = createTestControlHandler(testControlApi);

  const server = http.createServer(handleHttpRequest);
  const wss = new WebSocketServer({ server });

  wss.on('connection', (socket: WebSocket, req: http.IncomingMessage) => {
    const url = new URL(req.url || '/', `http://${req.headers.host}`);
    
    if (url.pathname === '/ws') {
      // Send initial config schema
      socket.send(JSON.stringify({ type: 'config.schema', data: configState }));

      // Send initial belief graph
      const proj = computeActiveSubgraph(narAdapter.listConcepts(), null, { maxNodes: 300, maxEdges: 600, maxHops: 2 });
      const ops: any[] = [
        ...proj.nodes.map(n => ({ action: 'add_node' as const, id: n.id, data: { priority: n.priority, confidence: n.confidence } })),
        ...proj.edges.map(e => ({ action: 'add_edge' as const, source: e.source, target: e.target, data: { weight: e.weight } })),
      ];
      socket.send(JSON.stringify({
        type: 'cognitive.delta',
        module: 'belief_graph',
        ops,
        meta: proj.truncated ? { truncated: true, total_hidden: proj.total_hidden } : undefined,
      }));

      // Send initial working memory
      const report = nar.attentionReport();
      socket.send(JSON.stringify({
        type: 'cognitive.delta',
        module: 'working_memory',
        ops: report.concepts.map((c: any) => ({
          action: 'add_node' as const,
          id: c.term.toString(),
          data: { priority: c.priority, confidence: 0.9 },
        })),
      }));

      // Send drives
      const drives = narAdapter.getDriveManager()?.getAllStates();
      if (drives) {
        socket.send(JSON.stringify({
          type: 'cognitive.delta',
          module: 'stream_reasoner',
          ops: drives.map(d => ({
            action: 'add_node' as const,
            id: d.spec.id,
            data: { priority: d.currentIntensity, confidence: 1 },
          })),
        }));
      }

      handleConnection(socket, narAdapter, (content, send) => onChat(content, send, agent));

      const sysBus = nar.getSystemEventBus();
      const unsubs = [
        sysBus.on('nar:derivation', () => {
          const proj = computeActiveSubgraph(narAdapter.listConcepts(), null, { maxNodes: 300, maxEdges: 600, maxHops: 2 });
          socket.send(JSON.stringify({
            type: 'cognitive.delta',
            module: 'belief_graph',
            ops: proj.nodes.map(n => ({
              action: 'add_node' as const,
              id: n.id,
              data: { priority: n.priority, confidence: n.confidence },
            })),
            meta: proj.truncated ? { truncated: true, total_hidden: proj.total_hidden } : undefined,
          }));
        }),
        sysBus.on('nar:concept:activated', (d: any) => {
          const term = typeof d.term === 'object' ? d.term.toString() : String(d.term);
          socket.send(JSON.stringify({
            type: 'cognitive.delta',
            module: 'working_memory',
            ops: [{ action: 'add_node' as const, id: term, data: { priority: d.priority ?? 0.5, confidence: 0.9 } }],
          }));
        }),
        sysBus.on('nar:reasoning:cycle', (d: any) => {
          socket.send(JSON.stringify({
            type: 'cognitive.delta',
            module: 'stream_reasoner',
            ops: [{ action: 'add_node' as const, id: 'cycle', data: { priority: d.cycle ?? 0, confidence: 1 } }],
          }));
        }),
        sysBus.on('nar:drive:changed', (d: any) => {
          socket.send(JSON.stringify({
            type: 'cognitive.delta',
            module: 'stream_reasoner',
            ops: [{ action: 'add_node' as const, id: d.drive ?? 'drive', data: { priority: d.urgency ?? 0, confidence: 1 } }],
          }));
        }),
        agent.on('agent:process:start', (d: any) => {
          socket.send(JSON.stringify({
            type: 'cognitive.delta',
            module: 'stream_reasoner',
            ops: [{ action: 'add_node' as const, id: 'status', data: { priority: 1, confidence: 1 } }],
          }));
        }),
        agent.on('agent:process:complete', (d: any) => {
          socket.send(JSON.stringify({
            type: 'cognitive.delta',
            module: 'stream_reasoner',
            ops: [{ action: 'add_node' as const, id: 'status', data: { priority: 0, confidence: 0 } }],
          }));
        }),
      ];

      socket.on('close', () => { for (const u of unsubs) u(); });
    }
  });

  return new Promise((resolve) => {
    server.listen(3000, '0.0.0.0', () => {
      console.log('UI server running on http://localhost:3000');
      resolve({
        close: () => new Promise<void>((resolve) => {
          wss.close(() => {
            server.close(() => resolve());
          });
        }),
        address: () => ({ port: 3000 }),
      });
    });
  });
}

function createTestControlApi(nar: NAR, agent: Agent) {
  return {
    async seedGraph(req: any, reply: any) {
      const { concepts } = req.body;
      for (const c of concepts) {
        await nar.believe(`${c.term}. %${c.f};${c.c}%`);
      }
      reply.send({ success: true, count: concepts.length });
    },
    async injectChat(req: any, reply: any) {
      const { stream, complete } = req.body;
      // Use the gateway's pending chat response
      const { setPendingChatResponse } = await import('./gateway.js');
      setPendingChatResponse(stream, complete);
      reply.send({ success: true });
    },
async injectDerivation(mockReq: any, mockReply: any) {
      const { conclusion, frequency = 0.85, confidence = 0.9 } = mockReq.body;
      console.error('[injectDerivation] conclusion:', JSON.stringify(conclusion), 'frequency:', frequency, 'confidence:', confidence);
      // Add the concept to NAR first so it appears in the graph - need trailing period for parser
      const termStr = `${conclusion}. %${frequency};${confidence}%`;
      console.error('[injectDerivation] termStr:', termStr);
      try {
        await nar.believe(termStr);
      } catch (e) {
        console.error('[injectDerivation] ERROR:', e);
        mockReply.status(500).send({ error: String(e) });
        return;
      }
      // Emit derivation event to trigger graph update
      nar.getSystemEventBus().emit('nar:derivation', {
        term: conclusion,
        confidence: frequency,
        timestamp: Date.now(),
      });
      mockReply.send({ success: true });
    },
    async getState(req: any, reply: any) {
      reply.send({
        concepts: nar.listConcepts().map(c => ({
          term: c.term.toString(),
          priority: c.priority,
          confidence: c.getBeliefs()[0]?.truth?.c ?? 0.9,
        })),
        workingMemory: nar.workingMemory.keys(),
      });
    },
    async reset(req: any, reply: any) {
      nar.clearMemory();
      reply.send({ success: true });
    },
  };
}

async function main() {
  const { SeNARSFactory } = await import('../../../src/nar/factory.js');
  const { createAgent } = await import('../../../src/agent/agent.js');
  const { DEFAULT_NAR_CONFIG } = await import('../../../src/config/index.js');

  const nar = SeNARSFactory.createDefault({ ...DEFAULT_NAR_CONFIG });
  const agent = createAgent({ nar });
  agent.start();
  const server = await startWebUI(nar, agent);

  const shutdown = () => {
    console.log('Shutting down UI server...');
    server.close();
    agent.stop();
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  process.stderr.write(`UI server failed: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});