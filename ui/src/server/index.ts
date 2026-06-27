import path from 'path';
import { fileURLToPath } from 'url';
import type { FastifyInstance } from 'fastify';
import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import fastifyWebSocket from '@fastify/websocket';
import type WebSocket from 'ws';
import type { Agent } from '../../../src/agent/types.js';
import type { NAR } from '../../../src/nar/nar.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

interface ConfigField {
  type: 'slider' | 'dropdown' | 'text' | 'toggle';
  label: string;
  value: number | string | boolean;
  options?: string[];
  min?: number;
  max?: number;
}

const configState: Record<string, ConfigField> = {
  'llm.temperature': { type: 'slider', label: 'LLM Temperature', value: 0.7, min: 0, max: 2 },
  'nars.revision_rate': { type: 'slider', label: 'NARS Revision Rate', value: 0.5, min: 0, max: 1 },
};

const configHandlers: Record<string, (v: number | string | boolean, nar: NAR) => void> = {};

function buildGraphElements(nar: NAR): any[] {
  const concepts = nar.listConcepts();
  const elements: any[] = [];
  const nodeIds = new Set<string>();

  for (const c of concepts) {
    const id = c.term.toString();
    nodeIds.add(id);
    elements.push({
      group: 'nodes',
      data: {
        id,
        color: c.priority > 0.5 ? '#00f3ff' : '#334155',
        size: Math.max(10, c.priority * 40),
      },
    });
  }

  for (const c of concepts) {
    const src = c.term.toString();
    for (const link of c.getLinks()) {
      const tgt = link.concept.term.toString();
      if (nodeIds.has(tgt)) {
        elements.push({ group: 'edges', data: { source: src, target: tgt } });
      }
    }
  }

  return elements;
}

export async function startWebUI(nar: NAR, agent: Agent): Promise<FastifyInstance> {
  const fastify = Fastify({ logger: true });

  fastify.register(fastifyStatic, {
    root: path.join(__dirname, '../../dist/client'),
    prefix: '/',
  });

  fastify.register(fastifyWebSocket);

  fastify.get('/ws', { websocket: true }, (socket: WebSocket) => {
    socket.send(JSON.stringify({ type: 'config.schema', data: configState }));

    socket.send(JSON.stringify({
      type: 'cognitive.update',
      module: 'belief_graph',
      data: { elements: buildGraphElements(nar) },
    }));

    const report = nar.attentionReport();
    socket.send(JSON.stringify({
      type: 'cognitive.update',
      module: 'working_memory',
      data: { concepts: report.concepts, total: report.total },
    }));

    const drives = nar.getDriveManager()?.getAllStates();
    if (drives) {
      socket.send(JSON.stringify({
        type: 'cognitive.update',
        module: 'drives',
        data: drives.map(d => ({ id: d.spec.id, name: d.spec.name, intensity: d.currentIntensity, active: d.isActive })),
      }));
    }

    const sysBus = nar.getSystemEventBus();
    const unsubs = [
      sysBus.on('nar:derivation', () => {
        socket.send(JSON.stringify({
          type: 'cognitive.update',
          module: 'belief_graph',
          data: { elements: buildGraphElements(nar) },
        }));
      }),
      sysBus.on('nar:concept:activated', (d: any) => {
        socket.send(JSON.stringify({
          type: 'cognitive.update',
          module: 'working_memory',
          data: { concept: d.term, priority: d.priority },
        }));
      }),
      sysBus.on('nar:reasoning:cycle', (d: any) => {
        socket.send(JSON.stringify({
          type: 'cognitive.update',
          module: 'stream_reasoner',
          data: { cycle: d.cycle, derived: d.derived },
        }));
      }),
      sysBus.on('nar:drive:changed', (d: any) => {
        socket.send(JSON.stringify({
          type: 'cognitive.update',
          module: 'drives',
          data: [{ id: d.drive, urgency: d.urgency }],
        }));
      }),
      agent.on('agent:process:start', (d: any) => {
        socket.send(JSON.stringify({
          type: 'cognitive.update',
          module: 'stream_reasoner',
          data: { status: 'processing', input: d.input, timestamp: d.timestamp },
        }));
      }),
      agent.on('agent:process:complete', (d: any) => {
        socket.send(JSON.stringify({
          type: 'cognitive.update',
          module: 'stream_reasoner',
          data: { status: 'complete', durationMs: d.durationMs, timestamp: d.timestamp },
        }));
      }),
    ];

    socket.on('message', async (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.type === 'chat.user') {
          const stream = agent.chat(msg.content, { stream: true });
          for await (const event of stream) {
            if (event.kind === 'text-delta') {
              socket.send(JSON.stringify({ type: 'chat.agent.stream', delta: event.text }));
            } else if (event.kind === 'finish') {
              socket.send(JSON.stringify({ type: 'chat.agent.complete', content: event.text }));
            } else if (event.kind === 'error') {
              socket.send(JSON.stringify({ type: 'chat.agent.complete', content: `Error: ${event.error}` }));
            }
          }
        } else if (msg.type === 'config.set') {
          fastify.log.info(`Config update: ${msg.key} = ${msg.value}`);
          if (msg.key in configState) {
            configState[msg.key]!.value = msg.value;
          }
          configHandlers[msg.key]?.(msg.value, nar);
        }
      } catch (e) {
        fastify.log.error({ err: e }, 'WS message error');
      }
    });

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
