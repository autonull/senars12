import path from 'path';
import { fileURLToPath } from 'url';
import type { FastifyInstance } from 'fastify';
import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import fastifyWebSocket from '@fastify/websocket';
import type WebSocket from 'ws';
import type { Agent } from '../../../src/agent/types.js';
import type { NAR } from '../../../src/nar/nar.js';
import { handleConnection, type NarAdapter } from './gateway.js';
import { computeActiveSubgraph } from './projection.js';
import type { IncomingFromServer } from '../shared/protocol.js';

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

export async function startWebUI(nar: NAR, agent: Agent): Promise<FastifyInstance> {
  const fastify = Fastify({ logger: true });

  fastify.register(fastifyStatic, {
    root: path.join(__dirname, '../../dist/client'),
    prefix: '/',
  });

  fastify.register(fastifyWebSocket);

  const narAdapter = buildNarAdapter(nar);

  fastify.get('/ws', { websocket: true }, (socket: WebSocket) => {
    socket.send(JSON.stringify({ type: 'config.schema', data: configState }));

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
  });

  fastify.setNotFoundHandler((_req, reply) => { reply.sendFile('index.html'); });
  await fastify.listen({ port: 3000, host: '0.0.0.0' });
  return fastify;
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
    server.log.info('Shutting down UI server...');
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
