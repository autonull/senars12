import { describe, it, expect, vi } from 'vitest';
import { createWakeGate } from '../../nar/src/lm/system-one/wake-gate.js';
import { createManifold } from '../../nar/src/lm/system-one/manifold.js';
import { createEmbeddingCache } from '../../nar/src/lm/system-one/embedding-cache.js';
import type { EvaluateProposition } from '../../nar/src/lm/system-one/types.js';

const budget = {
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

/** Fitted relevance head with a controllable score (Bench-20 oracle pattern). */
function relevanceManifold(score: number, opts: { fitted?: boolean; abstain?: boolean } = {}) {
  const cache = createEmbeddingCache({ maxSize: 100, ttlMs: 60_000, generator: fakeGenerator() });
  const manifold = createManifold(cache, { abstainThreshold: 0.05 });
  let evaluated = 0;
  manifold.registerHead({
    rubric: 'relevance',
    axis: 'epistemic',
    fitted: opts.fitted ?? true,
    evaluate: async () => {
      evaluated++;
      return { score, abstained: opts.abstain ?? false };
    },
  });
  return { cache, manifold, calls: () => evaluated };
}

describe('wake gate (E5)', () => {
  it('user input always wakes without a judgment', async () => {
    const { cache, manifold, calls } = relevanceManifold(0.1);
    const gate = createWakeGate({ manifold, embeddingCache: cache, budget });
    const verdict = await gate('consolidation due', { userInput: true });
    expect(verdict.decision).toBe('wake');
    expect(verdict.reason).toBe('user-input');
    expect(calls()).toBe(0);
  });

  it('relevance bands map to wake / not_yet / unrelated', async () => {
    for (const [score, expected] of [
      [0.9, 'wake'],
      [0.7, 'wake'],
      [0.5, 'not_yet'],
      [0.4, 'not_yet'],
      [0.1, 'unrelated'],
    ] as const) {
      const { cache, manifold } = relevanceManifold(score);
      const gate = createWakeGate({ manifold, embeddingCache: cache, budget });
      const verdict = await gate('sleep note');
      expect(verdict.decision).toBe(expected);
      expect(verdict.score).toBe(score);
      expect(verdict.abstained).toBe(false);
    }
  });

  it('abstain and unfitted heads fail open to wake', async () => {
    const abstainCase = relevanceManifold(0.9, { abstain: true });
    const abstainGate = createWakeGate({ manifold: abstainCase.manifold, embeddingCache: abstainCase.cache, budget });
    expect((await abstainGate('note')).decision).toBe('wake');
    expect((await abstainGate('note')).reason).toBe('abstain');

    const unfittedCase = relevanceManifold(0.1, { fitted: false });
    const unfittedGate = createWakeGate({ manifold: unfittedCase.manifold, embeddingCache: unfittedCase.cache, budget });
    const unfitted = await unfittedGate('note');
    expect(unfitted.decision).toBe('wake');
    expect(unfitted.reason).toBe('unfitted');
  });

  it('manifold failure fails open to wake', async () => {
    const { cache, manifold } = relevanceManifold(0.9);
    vi.spyOn(manifold, 'judgeBatch').mockRejectedValue(new Error('down'));
    const gate = createWakeGate({ manifold, embeddingCache: cache, budget });
    const verdict = await gate('note');
    expect(verdict.decision).toBe('wake');
    expect(verdict.reason).toBe('manifold-unavailable');
  });

  it('records a hash-only dataset label when supplied', async () => {
    const { cache, manifold } = relevanceManifold(0.8);
    const rows: unknown[] = [];
    const dataset = { record: (row: unknown) => rows.push(row) } as never;
    const gate = createWakeGate({ manifold, embeddingCache: cache, budget, dataset });
    await gate('sleep note');
    expect(rows).toHaveLength(1);
  });
});
