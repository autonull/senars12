import { describe, it, expect } from 'vitest';
import { createProvisionalStamp } from '../../nar/src/lm/system-one/provisional-stamp.js';
import { isProvisionalStamp } from '../../nar/src/lm/system-one/provisional-stamp.js';
import { SystemOneDispatcher, DeterministicManifold, StubCortex } from '../../nar/src/lm/system-one/dispatcher.js';
import { createManifold } from '../../nar/src/lm/system-one/manifold.js';
import { EmbeddingCache } from '../../nar/src/lm/system-one/embedding-cache.js';
import { PriorityBag } from '../../nar/src/bag/Bag.js';
import type { ReasoningBudget } from '@senars/kernel/schemas';
import type { EmbeddingPointer, JudgmentManifold, JudgmentProposition } from '../../nar/src/lm/system-one/types.js';

const budget: ReasoningBudget = {
  maxCycles: 100,
  maxDepth: 10,
  maxMemoryOps: 1000,
  maxLMCalls: 5,
  consumed: { cycles: 0, depth: 0, memoryOps: 0, llmCalls: 0 },
};

const context = { topBeliefs: ['b1'], topGoals: [], workingMemory: [], tickId: 't1' };

describe('System One — Provisional Stamps (Bench 5)', () => {
  it('decays exponentially to zero within TTL', () => {
    const stamp = createProvisionalStamp(
      { id: 's1', creationTime: 0 as never, source: 'LM', derivations: [] },
      0.1,
      0.3,
      30_000
    );
    expect(stamp.confidence(stamp.createdAt)).toBeCloseTo(0.1);
    const halfway = stamp.createdAt + 15_000;
    expect(stamp.confidence(halfway)).toBeGreaterThan(0);
    expect(stamp.confidence(halfway)).toBeLessThan(0.05);
    expect(stamp.confidence(stamp.expiresAt + 1)).toBe(0);
  });

  it('unvalidated Cortex hypotheses get ProvisionalStamps, not Truth', async () => {
    const dispatcher = new SystemOneDispatcher(
      new DeterministicManifold(),
      null,
      new DeterministicManifold(),
      new StubCortex(),
      false
    );
    const result = await dispatcher.proposeAndJudge(
      context,
      { kind: 'synthesize', instruction: 'propose', maxCandidates: 3 },
      [],
      budget
    );
    expect(result.candidates.length).toBe(3);
    expect(result.admitted).toHaveLength(0);
    expect(result.provisional).toHaveLength(3);
    for (const { provisional } of result.provisional) {
      expect(isProvisionalStamp(provisional)).toBe(true);
      expect(provisional.cInitial).toBeGreaterThan(0);
      expect(provisional.stamp.source).toBe('LM');
    }
  });

  it('validated hypotheses are admitted with Truth stamps', async () => {
    const cache = new EmbeddingCache({ maxSize: 100, ttlMs: 60_000 });
    await cache.warmup(['ctx']);
    const manifold = createManifold(cache, { abstainThreshold: 0.05 });
    const dispatcher = new SystemOneDispatcher(
      new DeterministicManifold(),
      manifold,
      new DeterministicManifold(),
      new StubCortex('stub', false),
      true,
      { embeddingCache: cache }
    );
    const result = await dispatcher.proposeAndJudge(
      context,
      { kind: 'synthesize', instruction: 'propose', maxCandidates: 3 },
      [],
      budget
    );
    expect(result.admitted.length + result.provisional.length).toBe(3);
    for (const { truth, stamp } of result.admitted) {
      expect(truth.f).toBeGreaterThanOrEqual(0);
      expect(truth.c).toBeLessThanOrEqual(0.6);
      expect(stamp.source).toBe('LM');
    }
    for (const { candidate } of result.admitted) {
      const rank = result.ranked.find((r) => r.candidate === candidate);
      expect(rank).toBeDefined();
    }
  });

  it('ranked candidates sort by truth frequency descending', async () => {
    const cache = new EmbeddingCache({ maxSize: 100, ttlMs: 60_000 });
    await cache.warmup(['ctx']);
    const manifold = createManifold(cache, { abstainThreshold: 0.05 });
    const dispatcher = new SystemOneDispatcher(
      new DeterministicManifold(),
      manifold,
      new DeterministicManifold(),
      new StubCortex('stub', false),
      true,
      { embeddingCache: cache }
    );
    const result = await dispatcher.proposeAndJudge(
      context,
      { kind: 'synthesize', instruction: 'propose', maxCandidates: 3 },
      [],
      budget
    );
    for (let i = 1; i < result.ranked.length; i++) {
      expect(result.ranked[i - 1]!.truth.f).toBeGreaterThanOrEqual(result.ranked[i]!.truth.f);
    }
  });

  it('provisional priority decays to zero via bag-native forgetting', () => {
    const stamp = createProvisionalStamp(
      { id: 's2', creationTime: 0 as never, source: 'LM', derivations: [] },
      0.1,
      0.3,
      30_000
    );
    const bag = new PriorityBag<{ id: string; priority: number }>({ capacity: 10, decayRate: 0, forgetRate: 0.0001 });
    bag.add({ id: stamp.stamp.id, priority: stamp.confidence(stamp.createdAt) });
    for (let i = 0; i < 200; i++) bag.decay(0.5);
    const entry = bag.find((item) => item.id === stamp.stamp.id);
    expect(!entry || entry.priority <= 0.001).toBe(true);
  });

  it('promotion via Truth.revision caps at MAX_CONFIDENCE', async () => {
    const { promoteProvisional } = await import('../../nar/src/lm/system-one/distill.js');
    const prop: JudgmentProposition = {
      kind: 'evaluate',
      axis: 'epistemic',
      score: 0.9,
      queryId: 'q1' as never,
      backendId: 'b' as never,
      modelDigest: 'm' as never,
      calibration: { version: 'v1' as never, ece: 0.02 },
      latencyMs: 1,
      cost: { tokensIn: 0, tokensOut: 0, computeMs: 0, memoryMb: 0 },
      tier: 1,
      abstained: false,
    };
    let truth = promoteProvisional(undefined, prop);
    expect(truth.f).toBeCloseTo(0.9);
    for (let i = 0; i < 10; i++) truth = promoteProvisional(truth, prop);
    expect(truth.c).toBeLessThanOrEqual(0.999);
  });

  it('failing Tier 1 falls back to provisional admission, not crash', async () => {
    const cache = new EmbeddingCache({ maxSize: 100, ttlMs: 60_000 });
    await cache.warmup(['ctx']);
    const failingManifold: JudgmentManifold = {
      async judgeBatch() {
        throw new Error('manifold unavailable');
      },
      consensus() {
        throw new Error('manifold unavailable');
      },
      health() {
        return { backendId: 'x' as never, ready: false, breakerOpen: true, rollingEce: 1, queueDepth: 0 };
      },
    };
    const dispatcher = new SystemOneDispatcher(
      new DeterministicManifold(),
      failingManifold,
      new DeterministicManifold(),
      new StubCortex('stub', false),
      true,
      { embeddingCache: cache }
    );
    const result = await dispatcher.proposeAndJudge(
      context,
      { kind: 'synthesize', instruction: 'propose', maxCandidates: 2 },
      [],
      budget
    );
    expect(result.admitted).toHaveLength(0);
    expect(result.provisional).toHaveLength(2);
  });
});
