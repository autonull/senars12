#!/usr/bin/env node
/**
 * D4: hosts the local manifold over the `/v1/systemone` wire shape
 * (`handleSystemOneRequest`). Run: pnpm exec tsx scripts/system-one-server.ts [port]
 * Client side: `createHttpManifold({ endpoint: 'http://127.0.0.1:<port>', embeddingCache })`.
 */
import { createServer } from 'node:http';
import { EmbeddingCache } from '../nar/src/lm/system-one/embedding-cache.js';
import { createManifold } from '../nar/src/lm/system-one/manifold.js';
import { handleSystemOneRequest } from '../nar/src/lm/system-one/http-endpoint.js';
import type { ReasoningBudget } from '@senars/kernel/schemas';

const port = Number(process.argv[2] ?? process.env.SYSTEMONE_SERVER_PORT ?? 8420);
const budget: ReasoningBudget = {
  maxCycles: 100,
  maxDepth: 10,
  maxMemoryOps: 1000,
  maxLMCalls: 5,
  consumed: { cycles: 0, depth: 0, memoryOps: 0, llmCalls: 0 },
};

const cache = new EmbeddingCache({ maxSize: 10_000, ttlMs: 600_000 });
const manifold = createManifold(cache, { abstainThreshold: 0.05 });

const server = createServer((req, res) => {
  if (req.method !== 'POST' || !req.url?.endsWith('/v1/systemone')) {
    res.writeHead(404).end();
    return;
  }
  const chunks: Buffer[] = [];
  req.on('data', (c: Buffer) => chunks.push(c));
  req.on('end', () => {
    const request = { json: async () => JSON.parse(Buffer.concat(chunks).toString('utf-8') || '{}') };
    void handleSystemOneRequest(request, manifold, budget, (vec) => cache.writeRaw(vec)).then(
      ({ status, body }) => {
        res.writeHead(status, { 'content-type': 'application/json' });
        res.end(JSON.stringify(body));
      },
      () => res.writeHead(500).end()
    );
  });
});

server.listen(port, () => {
  console.log(`system-one manifold listening on http://127.0.0.1:${port}/v1/systemone`);
});
