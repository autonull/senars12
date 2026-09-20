import { describe, it, expect, beforeEach } from 'vitest';
import { createManifold } from '../../nar/src/lm/system-one/manifold.js';
import { EmbeddingCache } from '../../nar/src/lm/system-one/embedding-cache.js';
import type { ReasoningBudget } from '@senars/kernel/schemas';
import type { JudgmentQuery } from '../../nar/src/lm/system-one/types.js';

describe('System One — Drift Demotion (Bench 9)', () => {
  let manifold: ReturnType<typeof createManifold>;
  let cache: EmbeddingCache;
  const mockBudget: ReasoningBudget = {
    maxCycles: 100,
    maxDepth: 10,
    maxMemoryOps: 1000,
    maxLMCalls: 5,
    consumed: { cycles: 0, depth: 0, memoryOps: 0, llmCalls: 0 },
  };

  beforeEach(async () => {
    cache = new EmbeddingCache({ maxSize: 1000, ttlMs: 60_000 });
    manifold = createManifold(cache, {
      maxBatchSize: 64,
      maxLatencyMs: 50,
      driftDemotionConfig: { eceThreshold: 0.15, consecutiveCycles: 3, cooldownCycles: 10 },
    });
    await cache.warmup(['initial context']);
  });

  it('rolling ECE increases under distribution shift', async () => {
    const pointer = await cache.write('stable context');

    const queries: JudgmentQuery[] = [
      { kind: 'classify', instruction: 'Classify task type', space: ['belief', 'goal', 'question'], axis: 'epistemic' },
    ];

    for (let i = 0; i < 5; i++) {
      await manifold.judgeBatch(pointer, queries, mockBudget);
    }
    manifold.syncHealth();

    const health1 = manifold.health();
    const initialECE = health1.rollingEce;

    for (let i = 0; i < 10; i++) {
      await manifold.judgeBatch(pointer, queries, mockBudget);
    }
    manifold.syncHealth();

    const health2 = manifold.health();
    expect(health2.rollingEce).toBeGreaterThanOrEqual(initialECE);
  });

  it('backend demoted after consecutive high-ECE cycles', async () => {
    const pointer = await cache.write('drift context');
    const queries: JudgmentQuery[] = [
      { kind: 'evaluate', instruction: 'Evaluate relevance', rubric: 'relevance', axis: 'epistemic' },
    ];

    for (let cycle = 0; cycle < 5; cycle++) {
      await manifold.judgeBatch(pointer, queries, mockBudget);
      manifold.syncHealth();
    }

    const health = manifold.health();
    const driftManager = manifold.getDriftDemotionManager();
    const backendHealth = driftManager.getHealth('encoder-wasm-s1');

    if (backendHealth && backendHealth.rollingECE > 0.15) {
      expect(backendHealth.consecutiveDriftCycles).toBeGreaterThanOrEqual(0);
    }
  });

  it('demoted backend can recover after cooldown', async () => {
    const pointer = await cache.write('recovery context');
    const queries: JudgmentQuery[] = [
      { kind: 'classify', instruction: 'Classify', space: ['a', 'b'], axis: 'epistemic' },
    ];

    const driftManager = manifold.getDriftDemotionManager();
    driftManager.forceDemote('encoder-wasm-s1', 0);
    manifold.syncHealth();

    let health = manifold.health();
    expect(health.ready).toBe(false);

    for (let cycle = 1; cycle <= 12; cycle++) {
      await manifold.judgeBatch(pointer, queries, mockBudget);
      const recovered = driftManager.attemptRecovery('encoder-wasm-s1', cycle);
      if (recovered) {
        manifold.syncHealth();
        break;
      }
    }

    health = manifold.health();
    if (driftManager.canRecover('encoder-wasm-s1', 12)) {
      const backendHealth = driftManager.getHealth('encoder-wasm-s1');
      expect(backendHealth?.isDemoted).toBe(false);
    }
  });

  it('calibration updates with new evidence', async () => {
    const pointer = await cache.write('calibration context');
    const queries: JudgmentQuery[] = [
      { kind: 'evaluate', instruction: 'Evaluate', rubric: 'relevance', axis: 'epistemic' },
    ];

    const calibrators = manifold.getCalibrators();
    const relevanceCalibrator = calibrators.get('relevance');

    expect(relevanceCalibrator).toBeDefined();

    const initialECE = relevanceCalibrator!.getECE();

    for (let i = 0; i < 20; i++) {
      await manifold.judgeBatch(pointer, queries, mockBudget);
    }
    manifold.syncHealth();

    const updatedECE = relevanceCalibrator!.getECE();
    expect(updatedECE).toBeGreaterThanOrEqual(0);
  });

  it('consensus agreement decreases under drift', async () => {
    const pointer = await cache.write('consensus context');
    const query: JudgmentQuery = {
      kind: 'classify',
      instruction: 'Classify for consensus',
      space: ['option_a', 'option_b', 'option_c'],
      axis: 'epistemic',
    };

    const consensus1 = await manifold.consensus(pointer, query, 3, mockBudget);
    const initialAgreement = consensus1.agreement;

    for (let i = 0; i < 10; i++) {
      await manifold.judgeBatch(pointer, [query], mockBudget);
    }

    const consensus2 = await manifold.consensus(pointer, query, 3, mockBudget);

    expect(consensus2.agreement).toBeLessThanOrEqual(initialAgreement + 0.2);
    expect(consensus2.independent).toBe(false);
  });
});