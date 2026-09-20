import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EmbeddingCache } from '../../nar/src/lm/system-one/embedding-cache.js';
import { createManifold } from '../../nar/src/lm/system-one/manifold.js';
import type { ReasoningBudget } from '@senars/kernel/schemas';
import type { JudgmentQuery, EmbeddingPointer } from '../../nar/src/lm/system-one/types.js';

describe('System One — Zero-Copy Batching (Bench 2)', () => {
  let cache: EmbeddingCache;
  let manifold: ReturnType<typeof createManifold>;
  const mockBudget: ReasoningBudget = {
    maxCycles: 100,
    maxDepth: 10,
    maxMemoryOps: 1000,
    maxLMCalls: 5,
    consumed: { cycles: 0, depth: 0, memoryOps: 0, llmCalls: 0 },
  };

  beforeEach(async () => {
    cache = new EmbeddingCache({ maxSize: 1000, ttlMs: 60_000 });
    manifold = createManifold(cache, { maxBatchSize: 64, maxLatencyMs: 50 });
    await cache.warmup(['test context for embedding']);
  });

  it('judgeBatch processes 64 queries in single joint pass', async () => {
    const queries: JudgmentQuery[] = Array.from({ length: 64 }, (_, i) => ({
      kind: 'classify' as const,
      instruction: `Classify query ${i}`,
      space: ['a', 'b', 'c'],
      axis: 'epistemic' as const,
      criticality: 'standard' as const,
    }));

    const contextPointer = await cache.write('shared context for batch');
    const start = performance.now();
    const results = await manifold.judgeBatch(contextPointer, queries, mockBudget);
    const elapsed = performance.now() - start;

    expect(results).toHaveLength(64);
    expect(elapsed).toBeLessThan(50);
  });

  it('zero text serialization — cache reads return pooled buffers', async () => {
    const text = 'test utterance for zero copy';
    const pointer = await cache.write(text);

    const buffer1 = cache.read(pointer);
    const buffer2 = cache.read(pointer);

    expect(buffer1).toBeDefined();
    expect(buffer2).toBeDefined();
    expect(buffer1).toBe(buffer2);
    expect(buffer1!.constructor.name).toBe('Float32Array');
  });

  it('repeated write returns same pointer (deduplication)', async () => {
    const text = 'duplicate test';
    const p1 = await cache.write(text);
    const p2 = await cache.write(text);

    expect(p1).toBe(p2);
  });

  it('cache eviction works under memory pressure', async () => {
    const smallCache = new EmbeddingCache({ maxSize: 5, ttlMs: 60_000 });
    const manifold2 = createManifold(smallCache, { maxBatchSize: 10, maxLatencyMs: 50 });

    for (let i = 0; i < 10; i++) {
      await smallCache.write(`item ${i}`);
    }

    expect(smallCache.size()).toBeLessThanOrEqual(5);
  });

  it('Manifold health reports correct backend state', () => {
    const health = manifold.health();
    expect(health.backendId).toBe('encoder-wasm-s1');
    expect(health.ready).toBe(true);
    expect(health.breakerOpen).toBe(false);
    expect(typeof health.rollingEce).toBe('number');
  });

  it('judgeBatch throws on batch size exceeding limit', async () => {
    const contextPointer = await cache.write('context');
    const tooManyQueries: JudgmentQuery[] = Array.from({ length: 65 }, (_, i) => ({
      kind: 'classify' as const,
      instruction: `Query ${i}`,
      space: ['a', 'b'],
      axis: 'epistemic' as const,
    }));

    await expect(manifold.judgeBatch(contextPointer, tooManyQueries, mockBudget)).rejects.toThrow('exceeds max');
  });

  it('propositions carry correct tier and resource cost', async () => {
    const queries: JudgmentQuery[] = [
      { kind: 'classify', instruction: 'test', space: ['a', 'b'], axis: 'epistemic' },
    ];
    const contextPointer = await cache.write('context');
    const results = await manifold.judgeBatch(contextPointer, queries, mockBudget);

    const prop = results[0]!;
    expect(prop.tier).toBe(1);
    expect(prop.cost.tokensIn).toBeGreaterThanOrEqual(0);
    expect(prop.cost.computeMs).toBeGreaterThanOrEqual(0);
    expect(prop.cost.memoryMb).toBeGreaterThanOrEqual(0);
    expect(prop.backendId).toBe('encoder-wasm-s1');
    expect(prop.modelDigest).toContain('sha256:');
  });
});