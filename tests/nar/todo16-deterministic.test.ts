import { describe, it, expect } from 'vitest';
import { EmbeddingCache } from '../../nar/src/lm/system-one/embedding-cache.js';
import { createManifold } from '../../nar/src/lm/system-one/manifold.js';
import type { JudgmentQuery, ReasoningBudget } from '../../nar/src/lm/system-one/types.js';

const budget: ReasoningBudget = {
  maxCycles: 100,
  maxDepth: 10,
  maxMemoryOps: 1000,
  maxLMCalls: 5,
  consumed: { cycles: 0, depth: 0, memoryOps: 0, llmCalls: 0 },
};

describe('System One — Deterministic Scoring (R1)', () => {
  it('produces identical results on repeated runs', async () => {
    const cache = new EmbeddingCache({ maxSize: 100, ttlMs: 60_000 });
    await cache.warmup(['ctx']);
    const manifold = createManifold(cache, { abstainThreshold: 0.05 });

    const queries: JudgmentQuery[] = [
      {
        kind: 'classify',
        instruction: 'Select tool action',
        space: ['move_north', 'none'],
        axis: 'teleological',
        criticality: 'standard',
      },
      {
        kind: 'evaluate',
        instruction: 'Evaluate risk',
        rubric: 'risk',
        axis: 'teleological',
        criticality: 'standard',
      },
      {
        kind: 'evaluate',
        instruction: 'Check groundedness',
        rubric: 'groundedness',
        axis: 'epistemic',
        criticality: 'standard',
      },
      {
        kind: 'evaluate',
        instruction: 'Check relevance',
        rubric: 'relevance',
        axis: 'epistemic',
        criticality: 'standard',
      },
      {
        kind: 'evaluate',
        instruction: 'Check feasibility',
        rubric: 'feasibility',
        axis: 'teleological',
        criticality: 'standard',
      },
    ];

    const pointer = await cache.write('select tool action move_north');
    
    // Run twice and verify identical results
    const results1 = await manifold.judgeBatch(pointer as never, queries, budget);
    const results2 = await manifold.judgeBatch(pointer as never, queries, budget);
    
    expect(results1.length).toBe(results2.length);
    
    for (let i = 0; i < results1.length; i++) {
      const r1 = results1[i]!;
      const r2 = results2[i]!;
      const score1 = r1.kind === 'evaluate' ? r1.score : r1.top.p;
      const score2 = r2.kind === 'evaluate' ? r2.score : r2.top.p;
      expect(score1).toBe(score2);
      expect(r1.abstained).toBe(r2.abstained);
    }
  });

  it('different inputs produce different scores', async () => {
    const cache = new EmbeddingCache({ maxSize: 100, ttlMs: 60_000 });
    await cache.warmup(['ctx']);
    const manifold = createManifold(cache, { abstainThreshold: 0.05 });

    const query: JudgmentQuery = {
      kind: 'classify',
      instruction: 'Select tool action',
      space: ['move_north', 'none'],
      axis: 'teleological',
      criticality: 'standard',
    };

    const pointer1 = await cache.write('input one');
    const pointer2 = await cache.write('input two');
    
    const results1 = await manifold.judgeBatch(pointer1 as never, [query], budget);
    const results2 = await manifold.judgeBatch(pointer2 as never, [query], budget);
    
    const score1 = results1[0]!.top.p;
    const score2 = results2[0]!.top.p;
    
    // Different inputs should produce different scores
    expect(score1).not.toBe(score2);
  });
});
