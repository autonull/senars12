/**
 * Custom head — extend the Judgment Manifold with your own rubric.
 * Run: `pnpm tsx examples/custom-head.ts`
 */
import { createManifold } from '../nar/src/lm/system-one/manifold.js';
import { EmbeddingCache } from '../nar/src/lm/system-one/embedding-cache.js';
import { HEAD_SPECS, createHead } from '../nar/src/lm/system-one/head-specs.js';
import type { JudgmentHead, JudgmentQuery } from '../nar/src/lm/system-one/types.js';

const cache = new EmbeddingCache({ maxSize: 100, ttlMs: 60_000 });
await cache.warmup(['hello world']);
const pointer = await cache.write('hello world');
const manifold = createManifold(cache);

// A custom head is any JudgmentHead — here a keyword-salience scorer
// registered under a fresh rubric id (the declarative equivalent of a HEAD_SPECS entry).
const salienceHead: JudgmentHead = {
  rubric: 'salience' as JudgmentHead['rubric'],
  axis: 'epistemic',
  fitted: true,
  async evaluate(embedding: Float32Array, query: JudgmentQuery) {
    const keywords = ['urgent', 'important', 'critical'];
    const hit = keywords.some((k) => query.instruction.toLowerCase().includes(k));
    return { score: hit ? 0.95 : 0.3 + 0.1 * (embedding[0] ?? 0), abstained: false };
  },
};
manifold.registerHead(salienceHead);

// Or derive a head from the declarative registry with a custom scorer:
const derived = createHead(HEAD_SPECS.relevance, { calibrationVersion: 'v1', embeddingCache: cache, abstainThreshold: 0.2 });
manifold.registerHead(derived);

const results = await manifold.judgeBatch(
  pointer as never,
  [
    { kind: 'evaluate', instruction: 'How salient is this urgent request?', rubric: 'salience' as never, axis: 'epistemic' },
    { kind: 'evaluate', instruction: 'Evaluate relevance of the context', rubric: 'relevance', axis: 'epistemic' },
  ] as never,
  { maxCycles: 10, maxDepth: 5, maxMemoryOps: 100, maxLMCalls: 10, consumed: { cycles: 0, depth: 0, memoryOps: 0, llmCalls: 0 } } as never
);

for (const p of results) {
  console.log(`${p.queryId}: score=${p.abstained ? 'abstain' : p.score.toFixed(3)} tier=${p.tier}`);
}
