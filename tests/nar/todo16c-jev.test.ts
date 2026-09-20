import { describe, it, expect } from 'vitest';
import {
  truthProbability,
  truthProbabilityOf,
  ConfidenceRouter,
  routeConfidence,
  isRestrictive,
  compositeScore,
  judgeCascade,
  type CompositeEntry,
} from '../../nar/src/lm/system-one/policy.js';
import { ActionGateTransducer } from '../../nar/src/lm/system-one/action-transducer.js';
import { createManifold } from '../../nar/src/lm/system-one/manifold.js';
import { createEmbeddingCache } from '../../nar/src/lm/system-one/embedding-cache.js';
import type {
  ClassifyProposition,
  EvaluateProposition,
  JudgmentQuery,
  ModelDigest,
  QueryId,
  BackendId,
} from '../../nar/src/lm/system-one/types.js';
import type { ReasoningBudget } from '@senars/kernel/schemas';

const budget: ReasoningBudget = {
  maxCycles: 100,
  maxDepth: 10,
  maxMemoryOps: 1000,
  maxLMCalls: 5,
  consumed: { cycles: 0, depth: 0, memoryOps: 0, llmCalls: 0 },
};

/** Deterministic hash-based embedding so real-manifold judgments are reproducible. */
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

function mkClassify(p: number, option = 'exploit'): ClassifyProposition {
  return {
    kind: 'classify',
    axis: 'teleological',
    queryId: 'q1' as QueryId,
    backendId: 'test' as BackendId,
    modelDigest: 'sha256:test' as ModelDigest,
    calibration: { version: 'v1' as never, ece: 0 },
    latencyMs: 1,
    cost: { tokensIn: 0, tokensOut: 0, computeMs: 1, memoryMb: 0 },
    tier: 1,
    abstained: false,
    distribution: [{ option, p }],
    top: { option, p },
    entropy: 0,
  };
}

describe('Jev Patterns (Bench 23)', () => {
  it('truthProbability() round-trips anchors ["false","true"] and extracts P(true) from a manifold judgment', async () => {
    const q = truthProbability('the robin is a bird');
    expect(q.kind).toBe('evaluate');
    expect(q.levels).toEqual(['false', 'true']);
    expect(q.rubric).toBe('plausibility');
    expect(q.axis).toBe('epistemic');
    expect(q.instruction).toContain('the robin is a bird');

    const cache = createEmbeddingCache({ maxSize: 100, ttlMs: 60_000, generator: fakeGenerator() });
    const manifold = createManifold(cache, { abstainThreshold: 0.05 });
    // Register a plausibility head for the truthProbability anchors (hand-registered, Bench-20 oracle pattern)
    manifold.registerHead({
      rubric: 'plausibility',
      axis: 'epistemic',
      fitted: true,
      evaluate: async () => ({ score: 0.75, abstained: false }),
    });
    const pointer = (await cache.write('ctx')) as never;
    const [prop] = await manifold.judgeBatch(pointer, [q], budget);
    if (!prop) throw new Error('no plausibility proposition returned');
    expect(prop.kind).toBe('evaluate');
    const pTrue = truthProbabilityOf(prop as EvaluateProposition);
    expect(pTrue).toBeDefined();
    expect(pTrue!).toBeGreaterThanOrEqual(0);
    expect(pTrue!).toBeLessThanOrEqual(1);

    expect(truthProbabilityOf({ ...mkClassify(0) as unknown as EvaluateProposition, abstained: true })).toBeUndefined();
  });

  it('ConfidenceRouter band mapping is deterministic (≥τ_act→act, τ_review..τ_act→review, <τ_review→block)', () => {
    const bands = { act: 0.8, review: 0.3, block: 0 };
    expect(routeConfidence(0.9, bands)).toBe('act');
    expect(routeConfidence(0.8, bands)).toBe('act');
    expect(routeConfidence(0.5, bands)).toBe('review');
    expect(routeConfidence(0.3, bands)).toBe('review');
    expect(routeConfidence(0.1, bands)).toBe('block');

    const router = new ConfidenceRouter(bands);
    expect(router.route(0.9)).toBe('act');
    expect(router.route({ abstained: true })).toBe('abstain');
    expect(router.route(mkClassify(0.5))).toBe('review');
    expect(router.route({ score: 0.1 })).toBe('block');
  });

  it('monotonicity: a router may only restrict, never promote', () => {
    const loose = new ConfidenceRouter({ act: 0.5, review: 0.2, block: 0 });
    const strict = new ConfidenceRouter({ act: 0.9, review: 0.6, block: 0.1 });
    expect(isRestrictive(strict.bands, loose.bands)).toBe(true);
    expect(isRestrictive(loose.bands, strict.bands)).toBe(false);
    expect(ConfidenceRouter.monotoneOver(strict, loose)).toBe(true);
    expect(ConfidenceRouter.monotoneOver(loose, strict)).toBe(false);
  });

  it('compositeScore respects declared weights and normalizes over non-abstained entries', () => {
    const entries: CompositeEntry[] = [
      { key: 'select', p: 0.5 },
      { key: 'feasibility', p: 1.0 },
    ];
    const weights = { select: 1, feasibility: 3 };
    const result = compositeScore(entries, weights)!;
    expect(result.score).toBeCloseTo(0.875, 12);
    expect(result.contributions.map((c) => c.weight)).toEqual([0.25, 0.75]);

    const withAbstain = compositeScore(
      [...entries, { key: 'conflict', p: 0, abstained: true }],
      weights
    )!;
    expect(withAbstain.score).toBeCloseTo(0.875, 12);

    expect(compositeScore([{ key: 'conflict', p: 0, abstained: true }], weights)).toBeUndefined();
    expect(compositeScore(entries, { unknown: 1 })).toBeUndefined();
  });

  it('judgeCascade derives the stage-2 space from the stage-1 top', async () => {
    const cache = createEmbeddingCache({ maxSize: 100, ttlMs: 60_000, generator: fakeGenerator() });
    const manifold = createManifold(cache, { abstainThreshold: 0.05 });
    await cache.warmup(['ctx']);
    const pointer = (await cache.write('ctx')) as never;

    const stage1: JudgmentQuery = {
      kind: 'classify',
      instruction: 'Classify the task type',
      space: ['belief', 'goal', 'question', 'command'],
      axis: 'epistemic',
    };
    const issued: JudgmentQuery[] = [];
    const spyJudge = {
      judgeBatch: async (ctx: never, queries: readonly JudgmentQuery[], b: ReasoningBudget) => {
        issued.push(...queries);
        return manifold.judgeBatch(ctx, queries, b);
      },
    };
    const { stage1: s1, stage2 } = await judgeCascade(
      spyJudge,
      pointer,
      stage1,
      (first) => {
        if (first.kind !== 'classify') return undefined;
        return first.top.option === 'question'
          ? { kind: 'classify', instruction: 'Clarify the question', space: ['clarify', 'answer'], axis: 'epistemic' }
          : { kind: 'classify', instruction: 'Tense of the statement', space: ['past', 'present', 'future'], axis: 'epistemic' };
      },
      budget
    );

    expect(s1.kind).toBe('classify');
    expect(stage2).toBeDefined();
    expect(stage2!.kind).toBe('classify');
    // Stage-2 space is derived from the stage-1 top (two-stage dependency)
    const top = (s1 as ClassifyProposition).top.option;
    expect(issued).toHaveLength(2);
    expect((issued[1] as { space?: string[] }).space).toEqual(
      top === 'question' ? ['clarify', 'answer'] : ['past', 'present', 'future']
    );

    const singleStage = await judgeCascade(manifold, pointer, stage1, () => undefined, budget);
    expect(singleStage.stage2).toBeUndefined();
  });

  it('ActionGateTransducer routes bands: act ⇒ desire-seeded, review ⇒ propose-only, block ⇒ none', () => {
    const router = new ConfidenceRouter({ act: 0.8, review: 0.3, block: 0 });
    const transducer = new ActionGateTransducer({ router });

    const act = transducer.transduce(mkClassify(0.9)!);
    expect(act).toBeDefined();
    expect(act!.args).toEqual({});

    const review = transducer.transduce(mkClassify(0.5)!);
    expect(review).toBeDefined();
    expect(review!.args).toBeUndefined();
    expect(review!.confidence).toBe(0.5);

    expect(transducer.transduce(mkClassify(0.1)!)).toBeUndefined();
  });

  it('default threshold router preserves the legacy bare-τ split byte-for-byte', () => {
    const transducer = new ActionGateTransducer({ threshold: 0.5 });
    const at = transducer.transduce(mkClassify(0.6)!);
    const below = transducer.transduce(mkClassify(0.4)!);
    expect(at!.args).toEqual({});
    expect(below!.value).toBe(0.4);
    expect(below!.confidence).toBe(0.4);
  });
});
