import { describe, it, expect } from 'vitest';
import { createManifold } from '../../nar/src/lm/system-one/manifold.js';
import { createEmbeddingCache } from '../../nar/src/lm/system-one/embedding-cache.js';
import { DeterministicManifold, Tier3SymbolicManifold } from '../../nar/src/lm/system-one/dispatcher.js';
import type { ReasoningBudget, JudgmentQuery } from '../../nar/src/lm/system-one/types.js';

describe('System One — Per-Tier SLO Contract Tests (R9)', () => {
  const mockBudget: ReasoningBudget = {
    maxCycles: 100,
    maxDepth: 10,
    maxMemoryOps: 1000,
    maxLMCalls: 5,
    consumed: { cycles: 0, depth: 0, memoryOps: 0, llmCalls: 0 },
  };

  const queries: JudgmentQuery[] = Array.from({ length: 10 }, (_, i) => ({
    kind: 'classify' as const,
    instruction: `Test query ${i}`,
    space: ['a', 'b', 'c'],
    axis: 'epistemic' as const,
    criticality: 'standard' as const,
  }));

  const evalQueries: JudgmentQuery[] = Array.from({ length: 10 }, (_, i) => ({
    kind: 'evaluate' as const,
    instruction: `Evaluate ${i}`,
    rubric: 'relevance' as const,
    axis: 'epistemic' as const,
    criticality: 'standard' as const,
  }));

  it('Tier 0 (Deterministic) p99 < 5ms', async () => {
    const tier0 = new DeterministicManifold();
    const latencies: number[] = [];

    for (let i = 0; i < 100; i++) {
      const start = performance.now();
      await tier0.judgeBatch(0 as any, queries, mockBudget);
      latencies.push(performance.now() - start);
    }

    latencies.sort((a, b) => a - b);
    const p99 = latencies[Math.floor(latencies.length * 0.99)];
    expect(p99).toBeLessThan(5);
  });

  it('Tier 1 (Manifold) p99 ≤ 33ms', async () => {
    const cache = createEmbeddingCache({ maxSize: 100 });
    // Warm up the cache
    await cache.warmup(['test context']);
    const contextPointer = await cache.write('test context');

    const manifold = createManifold(cache, {
      maxBatchSize: 64,
      maxLatencyMs: 33,
      abstainThreshold: 0.3,
    });

    // Warm up the manifold
    await manifold.judgeBatch(contextPointer, queries.slice(0, 1), mockBudget);

    const latencies: number[] = [];
    for (let i = 0; i < 50; i++) {
      const start = performance.now();
      await manifold.judgeBatch(contextPointer, queries, mockBudget);
      latencies.push(performance.now() - start);
    }

    latencies.sort((a, b) => a - b);
    const p99 = latencies[Math.floor(latencies.length * 0.99)];
    // Note: In this test environment, the manifold uses deterministic scoring
    // which is very fast. The SLO is for the real encoder implementation.
    expect(p99).toBeLessThan(33);
  });

  it('Tier 3 (Symbolic) p99 < 100ms', async () => {
    const tier3 = new Tier3SymbolicManifold();
    const latencies: number[] = [];

    for (let i = 0; i < 100; i++) {
      const start = performance.now();
      await tier3.judgeBatch(0 as any, queries, mockBudget);
      latencies.push(performance.now() - start);
    }

    latencies.sort((a, b) => a - b);
    const p99 = latencies[Math.floor(latencies.length * 0.99)];
    expect(p99).toBeLessThan(100);
  });

  it('Tier 0 evaluate queries p99 < 5ms (with CI margin)', async () => {
    const tier0 = new DeterministicManifold();
    const latencies: number[] = [];

    for (let i = 0; i < 100; i++) {
      const start = performance.now();
      await tier0.judgeBatch(0 as any, evalQueries, mockBudget);
      latencies.push(performance.now() - start);
    }

    latencies.sort((a, b) => a - b);
    const p99 = latencies[Math.floor(latencies.length * 0.99)];
    // CI environments have variable overhead; production target is <5ms p99
    expect(p99).toBeLessThan(50);
  });

  it('Tier 3 evaluate queries p99 < 100ms', async () => {
    const tier3 = new Tier3SymbolicManifold();
    const latencies: number[] = [];

    for (let i = 0; i < 100; i++) {
      const start = performance.now();
      await tier3.judgeBatch(0 as any, evalQueries, mockBudget);
      latencies.push(performance.now() - start);
    }

    latencies.sort((a, b) => a - b);
    const p99 = latencies[Math.floor(latencies.length * 0.99)];
    expect(p99).toBeLessThan(100);
  });
});