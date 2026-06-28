import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { NAR } from '../../../src/nar/nar.js';
import type { Agent } from '../../../src/agent/types.js';
import { setPendingChatResponse } from './gateway.js';

export function registerTestControl(fastify: FastifyInstance, nar: NAR, _agent: Agent | null) {
  if (process.env.NODE_ENV !== 'test') return;

  fastify.post('/test/seed-graph', async (req, reply) => {
    const schema = z.object({
      concepts: z.array(z.object({
        term: z.string(),
        f: z.number(),
        c: z.number(),
      })),
    });
    const { concepts } = schema.parse(req.body);

    for (const c of concepts) {
      await nar.believe(`${c.term} %${c.f};${c.c}%`);
    }

    return { success: true, count: concepts.length };
  });

  fastify.post('/test/inject-chat', async (req, reply) => {
    const schema = z.object({
      stream: z.string(),
      complete: z.string(),
    });
    const data = schema.parse(req.body);
    setPendingChatResponse(data.stream, data.complete);
    return { success: true };
  });

  fastify.post('/test/inject-derivation', async (req, reply) => {
    const schema = z.object({
      conclusion: z.string(),
      priority: z.number().optional(),
    });
    const { conclusion, priority = 0.85 } = schema.parse(req.body);

    nar.getSystemEventBus().emit('nar:derivation', {
      term: conclusion,
      confidence: priority,
      timestamp: Date.now(),
    });

    return { success: true };
  });

  fastify.get('/test/state', async () => ({
    concepts: nar.listConcepts().map(c => ({
      term: c.term.toString(),
      priority: c.priority,
      confidence: c.getBeliefs()[0]?.truth?.c ?? 0.9,
    })),
    workingMemory: nar.workingMemory.keys(),
  }));

  fastify.post('/test/reset', async () => {
    nar.clearMemory();
    return { success: true };
  });
}