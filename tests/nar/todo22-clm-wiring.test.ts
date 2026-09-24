import { describe, expect, it } from 'vitest';
import { ContrastiveMemory } from '../../nar/src/lm/system-one/contrastive.js';
import { createDispatcher } from '../../nar/src/lm/system-one/dispatcher.js';
import { createEmbeddingCache } from '../../nar/src/lm/system-one/embedding-cache.js';
import { createGroundednessGate } from '../../nar/src/lm/system-one/groundedness-gate.js';
import { createManifold } from '../../nar/src/lm/system-one/manifold.js';
import { LMReflex } from '../../nar/src/lm/system-one/lm-reflex.js';
import { ManifoldReflex } from '../../nar/src/lm/system-one/manifold-reflex.js';
import { createTraceGrader } from '../../nar/src/lm/system-one/trace-grader.js';
import type { CognitiveDispatcher, JudgmentManifold, PEAResult } from '../../nar/src/lm/system-one/types.js';
import type { ReasoningBudget } from '@senars/kernel/schemas';
import type { ActionProposal, Reflex } from '../../nar/src/reflex/Reflex.js';
import { EpsilonGreedyReflex } from '../../nar/src/reflex/EpsilonGreedyReflex.js';

const dim = 32;

/** Bag-of-words embedding so shared words cluster (same geometry as todo22-contrastive). */
const directional = (text: string): Float32Array => {
  const v = new Float32Array(dim);
  for (const word of text.toLowerCase().split(/\W+/).filter(Boolean)) {
    const seed = word.split('').reduce((h, c) => h * 31 + c.charCodeAt(0), 7);
    for (let i = 0; i < dim; i++) v[i]! += Math.sin(seed * 0.1 + i);
  }
  const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1;
  return v.map((x) => x / norm);
};

const cache = createEmbeddingCache({
  maxSize: 200,
  generator: { generate: async (text: string) => [...directional(text)] },
});

const BUDGET: ReasoningBudget = {
  maxCycles: 100,
  maxDepth: 10,
  maxMemoryOps: 1000,
  maxLMCalls: 5,
  consumed: { cycles: 0, depth: 0, memoryOps: 0, llmCalls: 0 },
};

const memoryWithExemplars = async (): Promise<ContrastiveMemory> => {
  const memory = new ContrastiveMemory();
  await memory.add(
    'groundedness',
    { positives: ['sunny meadow', 'sunny meadow walks', 'sunny meadow breeze'], negatives: ['dark storm', 'dark storm thunder'] },
    cache
  );
  memory.calibrateAll();
  return memory;
};

describe('TODO22 CLM — manifold headless contrastive fallback', () => {
  it('judges an unknown rubric via stored exemplars instead of throwing', async () => {
    const memory = await memoryWithExemplars();
    const manifold = createManifold(cache, { contrastive: memory });
    const pointer = await cache.write('sunny meadow day');
    const results = await manifold.judgeBatch(
      pointer,
      [{ kind: 'evaluate', instruction: 'Evaluate groundedness', rubric: 'groundedness' as never, axis: 'epistemic' }],
      BUDGET
    );
    expect(results).toHaveLength(1);
    expect(results[0]!.abstained).toBe(false);
    expect((results[0] as { score: number }).score).toBeGreaterThan(0.5);
    expect(manifold.getContrastiveMemory()).toBe(memory);
  });

  it('still throws for rubrics with no head and no exemplars', async () => {
    const manifold = createManifold(cache, { contrastive: new ContrastiveMemory() });
    const pointer = await cache.write('anything at all');
    await expect(
      manifold.judgeBatch(
        pointer,
        [{ kind: 'evaluate', instruction: 'x', rubric: 'nonexistent_rubric' as never, axis: 'epistemic' }],
        BUDGET
      )
    ).rejects.toThrow(/No head registered/);
  });

  it('suggestHeadSize follows the power law and clamps', () => {
    const manifold = createManifold(cache);
    // 64 labels (N₀) → full width.
    expect(manifold.suggestHeadSize(64, 384)).toBe(384);
    // Tiny budget in a tiny dim space clamps at the 8 floor.
    expect(manifold.suggestHeadSize(1, 12)).toBe(8);
    // Sub-linear growth: sub-N₀ budgets yield partial width.
    const w1 = manifold.suggestHeadSize(1, 384);
    const w64 = manifold.suggestHeadSize(64, 384);
    expect(w1).toBeLessThan(384);
    expect(w64).toBeGreaterThan(w1!);
    // Over-budget data clamps at the embedding dim.
    expect(manifold.suggestHeadSize(256, 384)).toBe(384);
    expect(manifold.getLastSuggestedHeadSize()).toBe(384);
    expect(manifold.suggestHeadSize(0, 384)).toBe(0);
  });
});

describe('TODO22 CLM — groundedness gate contrastive fallback', () => {
  it('accepts in-domain narration when the manifold head abstains', async () => {
    const memory = await memoryWithExemplars();
    // abstainThreshold 1.0 ⇒ every head abstains ⇒ gate falls back to contrastive.
    const manifold = createManifold(cache, { abstainThreshold: 1.0, contrastive: memory });
    const gate = createGroundednessGate({ manifold, embeddingCache: cache, threshold: 0.4, contrastive: memory });
    expect(await gate('sunny meadow day')).toBe(true);
    expect(await gate('dark storm thunder night')).toBe(false);
  });

  it('fails closed when neither head nor contrastive is available', async () => {
    const manifold = createManifold(cache, { abstainThreshold: 1.0 });
    const gate = createGroundednessGate({ manifold, embeddingCache: cache, threshold: 0.7 });
    expect(await gate('sunny meadow day')).toBe(false);
  });
});

describe('TODO22 CLM — trace grader contrastive quality', () => {
  it('emits contrastiveQuality for graded narrations', async () => {
    const memory = await memoryWithExemplars();
    const manifold = createManifold(cache, { contrastive: memory });
    const grader = createTraceGrader({ manifold, embeddingCache: cache, contrastive: memory });
    const result = await grader({ narration: 'sunny meadow day', toolCalls: [] });
    expect(result.contrastiveQuality).toBeDefined();
    expect(result.contrastiveQuality!).toBeGreaterThan(0.4);
  });

  it('omits contrastiveQuality without a contrastive memory', async () => {
    const manifold = createManifold(cache);
    const grader = createTraceGrader({ manifold, embeddingCache: cache });
    const result = await grader({ narration: 'sunny meadow day', toolCalls: [] });
    expect(result.contrastiveQuality).toBeUndefined();
  });
});

describe('TODO22 CLM — dispatcher contrastive routing', () => {
  it('proposeAndJudge applies negative penalties with a real (non-placeholder) cortex', async () => {
    const memory = await memoryWithExemplars();
    const manifold = createManifold(cache, { contrastive: memory });
    // Non-placeholder cortex: yields one candidate per maxCandidates slot.
    const cortex = {
      synthesize: async function* (_c: unknown, q: { maxCandidates?: number }) {
        yield {
          kind: 'synthesize' as const,
          candidates: ['dark storm chaos', 'sunny meadow walk'].slice(
            0,
            q.maxCandidates ?? 3
          ),
          cost: { tokensIn: 0, tokensOut: 0, computeMs: 0, memoryMb: 0 },
        };
      },
      health: () => ({ provider: 'test', breakerOpen: false }),
    };
    const dispatcher = createDispatcher(
      true,
      { embeddingCache: cache, tier1Manifold: manifold, contrastive: memory },
      cortex as never
    );
    const context = { tickId: 't1', topBeliefs: [], topGoals: ['pick'], workingMemory: [] };
    const result = await dispatcher.proposeAndJudge(
      context,
      { kind: 'synthesize', instruction: 'choose', maxCandidates: 2 },
      [],
      BUDGET
    );
    expect(result.candidates.length).toBe(2);
    expect(result.ranked.length).toBe(2);
    // Ranking runs without throwing even when the manifold abstains (safety floor).
    expect(result.provisional.length + result.admitted.length).toBe(2);
  });

  it('passes the contrastive option through createDispatcher', () => {
    const memory = new ContrastiveMemory();
    const dispatcher = createDispatcher(true, { contrastive: memory });
    expect(dispatcher).toBeDefined();
    expect(typeof dispatcher.proposeAndJudge).toBe('function');
  });
});

describe('TODO22 CLM — reflexes', () => {
  class NoopFallback implements Reflex {
    readonly id = 'noop';
    propose(): ActionProposal[] {
      return [];
    }
    learn(): void {}
  }

  it('ManifoldReflex reuses cached action queries across ticks (disaggregated embeddings)', async () => {
    const memory = await memoryWithExemplars();
    const manifold = createManifold(cache, { contrastive: memory });
    const reflex = new ManifoldReflex(new EpsilonGreedyReflex('fb', { numArms: 4, epsilon: 0 }));
    const state = { stateId: 's0', features: { x: 1 } };
    await reflex.prefetch('s0', await cache.write('state'), ['0', '1'], manifold, BUDGET, state);
    const queriesBefore = cache.metrics().writes;
    await reflex.prefetch('s1', await cache.write('state'), ['0', '1'], manifold, BUDGET, state);
    // Only the state re-encodes; per-action queries are cached (writes unchanged).
    expect(cache.metrics().writes).toBe(queriesBefore);
  });

  it('LMReflex contrastive verification demotes near-negative proposals', async () => {
    const memory = await memoryWithExemplars();
    // 'dark storm thunder' is maximally close to a stored negative;
    // 'sunny meadow day' is close to a stored positive.
    const dispatcher: CognitiveDispatcher = {
      judge: async () => [],
      synthesize: async function* () {},
      proposeAndJudge: async (_c: unknown, _q: unknown): Promise<PEAResult> => ({
        candidates: ['dark storm thunder', 'sunny meadow day'],
        judgments: [],
        ranked: [
          { candidate: 'dark storm thunder', truth: { f: 0.9, c: 0.9 } as never },
          { candidate: 'sunny meadow day', truth: { f: 0.6, c: 0.6 } as never },
        ],
        admitted: [],
        provisional: [],
      }),
    } as unknown as CognitiveDispatcher;
    const lmReflex = new LMReflex({
      fallback: new NoopFallback(),
      dispatcher,
      embeddingCache: cache,
      budget: BUDGET,
      contrastive: memory,
    });
    const perception = { stateId: 's9', features: {} } as never;
    await lmReflex.prefetch('s9', 0 as never, ['dark storm thunder', 'sunny meadow day'], undefined, BUDGET, perception);
    expect(lmReflex.contrastiveVetoes).toBe(1);
    const proposals = lmReflex.propose(perception, ['dark storm thunder', 'sunny meadow day']);
    expect(proposals[0]!.action).toBe('sunny meadow day');
    expect(proposals[0]!.source).toBe('lm-reflex');
  });

  it('LMReflex keeps the ranked order when contrastive is empty', async () => {
    const dispatcher: CognitiveDispatcher = {
      judge: async () => [],
      synthesize: async function* () {},
      proposeAndJudge: async (): Promise<PEAResult> => ({
        candidates: ['a', 'b'],
        judgments: [],
        ranked: [
          { candidate: 'a', truth: { f: 0.9, c: 0.9 } as never },
          { candidate: 'b', truth: { f: 0.5, c: 0.5 } as never },
        ],
        admitted: [],
        provisional: [],
      }),
    } as unknown as CognitiveDispatcher;
    const lmReflex = new LMReflex({
      fallback: new NoopFallback(),
      dispatcher,
      embeddingCache: cache,
      budget: BUDGET,
    });
    const perception = { stateId: 's10', features: {} } as never;
    await lmReflex.prefetch('s10', 0 as never, ['a', 'b'], undefined, BUDGET, perception);
    expect(lmReflex.contrastiveVetoes).toBe(0);
    const proposals = lmReflex.propose(perception, ['a', 'b']);
    expect(proposals[0]!.action).toBe('a');
  });
});
