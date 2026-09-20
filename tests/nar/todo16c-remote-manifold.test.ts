import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createServer, type Server } from 'node:http';
import { createHttpManifold } from '../../nar/src/lm/system-one/http-manifold.js';
import { handleSystemOneRequest } from '../../nar/src/lm/system-one/http-endpoint.js';
import { createManifold } from '../../nar/src/lm/system-one/manifold.js';
import { createEmbeddingCache } from '../../nar/src/lm/system-one/embedding-cache.js';
import { admitRemotePropositions } from '../../nar/src/lm/system-one/http-endpoint.js';
import type { ReasoningBudget } from '@senars/kernel/schemas';

const budget: ReasoningBudget = {
  maxCycles: 100,
  maxDepth: 10,
  maxMemoryOps: 1000,
  maxLMCalls: 5,
  consumed: { cycles: 0, depth: 0, memoryOps: 0, llmCalls: 0 },
};

function fakeGenerator(dimension = 384) {
  return {
    async generate(text: string): Promise<number[]> {
      const vec = new Array<number>(dimension).fill(0);
      let h = 2166136261;
      for (let i = 0; i < text.length; i++) {
        h ^= text.charCodeAt(i);
        h = Math.imul(h, 16777619) >>> 0;
        vec[i % dimension] = ((h >>> 8) % 2000) / 1000 - 1;
      }
      return vec;
    },
  };
}

function fakeCache() {
  return createEmbeddingCache({ maxSize: 100, ttlMs: 60_000, generator: fakeGenerator() });
}

describe('D4 remote manifold (/v1/systemone client + server)', () => {
  let server: Server;
  let url: string;

  beforeAll(async () => {
    const serverCache = fakeCache();
    const serverManifold = createManifold(serverCache, { abstainThreshold: 0.05 });
    server = createServer((req, res) => {
      if (req.method !== 'POST' || !req.url?.endsWith('/v1/systemone')) {
        res.writeHead(404).end();
        return;
      }
      
      const chunks: Buffer[] = [];
      req.on('data', (c: Buffer) => chunks.push(c));
      req.on('end', () => {
        const request = { json: async () => JSON.parse(Buffer.concat(chunks).toString('utf-8') || '{}') };
        void handleSystemOneRequest(request, serverManifold, budget, (vec) => serverCache.writeRaw(vec)).then(
          ({ status, body }) => {
            res.writeHead(status, { 'content-type': 'application/json' });
            res.end(JSON.stringify(body));
          },
          () => res.writeHead(500).end()
        );
      });
    });
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const addr = server.address();
    if (!addr || typeof addr === 'string') throw new Error('no port');
    url = `http://127.0.0.1:${addr.port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('client round-trips judgeBatch over the wire; untrusted results re-enter at the LLM_PRIOR ceiling', async () => {
    const cache = fakeCache();
    const remote = createHttpManifold({ endpoint: url, embeddingCache: cache });
    const pointer = await cache.write('the robin is a bird');
    const propositions = await remote.judgeBatch(pointer as never, [
      { kind: 'evaluate', instruction: 'Evaluate relevance', rubric: 'relevance', axis: 'epistemic' },
      { kind: 'classify', instruction: 'Classify task type', space: ['belief', 'goal', 'question', 'command'], axis: 'epistemic' },
    ], budget);

    expect(propositions).toHaveLength(2);
    for (const p of propositions) {
      if (!p.abstained) {
        const [admitted] = admitRemotePropositions([p], 'LLM_PRIOR');
        expect(admitted!.truth!.c).toBeLessThanOrEqual(0.5);
      }
    }
    expect(remote.health().ready).toBe(true);
  });

  it('consensus delegates to one batched pass', async () => {
    const cache = fakeCache();
    const remote = createHttpManifold({ endpoint: url, embeddingCache: cache });
    const pointer = await cache.write('consensus probe');
    const { proposition, agreement } = await remote.consensus(pointer as never, {
      kind: 'evaluate',
      instruction: 'Evaluate relevance',
      rubric: 'relevance',
      axis: 'epistemic',
    }, 3, budget);
    expect(proposition).toBeDefined();
    expect(agreement).toBe(1);
  });

  it('malformed remote responses and server errors fail closed (health not ready)', async () => {
    const garbage = createServer((_req, res) => {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end('{"propositions": "not-an-array"}');
    });
    await new Promise<void>((resolve) => garbage.listen(0, resolve));
    const gAddr = garbage.address();
    const gUrl = `http://127.0.0.1:${typeof gAddr === 'object' && gAddr ? gAddr.port : 0}`;
    try {
      const cache = fakeCache();
      const remote = createHttpManifold({ endpoint: gUrl, embeddingCache: cache });
      const pointer = await cache.write('bad probe');
      await expect(remote.judgeBatch(pointer as never, [
        { kind: 'evaluate', instruction: 'x', rubric: 'relevance', axis: 'epistemic' },
      ], budget)).rejects.toThrow();
      expect(remote.health().ready).toBe(false);
      expect(remote.health().breakerOpen).toBe(true);
    } finally {
      await new Promise<void>((resolve) => garbage.close(() => resolve()));
    }

    const downCache = fakeCache();
    const down = createHttpManifold({ endpoint: 'http://127.0.0.1:1', embeddingCache: downCache, timeoutMs: 500 });
    await expect(down.judgeBatch((await downCache.write('x')) as never, [
      { kind: 'evaluate', instruction: 'x', rubric: 'relevance', axis: 'epistemic' },
    ], budget)).rejects.toThrow();
    expect(down.health().breakerOpen).toBe(true);
  });
});
