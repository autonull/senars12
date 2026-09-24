import { describe, expect, it } from 'vitest';
import { ContrastiveMemory } from '../../nar/src/lm/system-one/contrastive.js';
import { createDecider, type DecideDeps } from '../../nar/src/lm/system-one/decide.js';
import { createEmbeddingCache } from '../../nar/src/lm/system-one/embedding-cache.js';
import type {
  EmbeddingPointer,
  EvaluateProposition,
  JudgmentProposition,
  JudgmentQuery,
} from '../../nar/src/lm/system-one/types.js';

const dim = 32;
const BUDGET = {
  maxCycles: 100,
  maxDepth: 10,
  maxMemoryOps: 1000,
  maxLMCalls: 5,
  consumed: { cycles: 0, depth: 0, memoryOps: 0, llmCalls: 0 },
};

/** Deterministic bag-of-words embedding (same geometry as the TODO22 tests). */
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
  maxSize: 100,
  generator: { generate: async (text: string) => [...directional(text)] },
});

const evaluateProp = (
  rubric: string,
  score: number,
  abstained = false
): JudgmentProposition =>
  ({
    kind: 'evaluate',
    axis: 'epistemic',
    rubric,
    queryId: 'q1' as never,
    backendId: 'test' as never,
    modelDigest: 'md5-digest' as never,
    calibration: { version: 'v2.4.1' as never, ece: 0.02, fitted: true },
    latencyMs: 1,
    cost: { tokensIn: 0, tokensOut: 0, computeMs: 0, memoryMb: 0 },
    tier: 1,
    score,
    abstained,
  }) as never;

const classifyProp = (
  rubric: string,
  distribution: { option: string; p: number }[],
  abstained = false
): JudgmentProposition =>
  ({
    kind: 'classify',
    axis: 'teleological',
    rubric,
    queryId: 'q2' as never,
    backendId: 'test' as never,
    modelDigest: 'md5-digest' as never,
    calibration: { version: 'v2.4.1' as never, ece: 0.02, fitted: false },
    latencyMs: 1,
    cost: { tokensIn: 0, tokensOut: 0, computeMs: 0, memoryMb: 0 },
    tier: 1,
    distribution,
    top: distribution[0]!,
    entropy: 0.1,
    abstained,
  }) as never;

/** Scripted tiered judge: deterministic scores by rubric. */
const scriptedJudge = (scores: Record<string, number>): DecideDeps['judge'] => async (
  _pointer,
  queries
) => queries.map((q: JudgmentQuery) => {
  const rubric = q.kind === 'classify' ? (q.rubric ?? 'task_type') : q.rubric;
  if (q.kind === 'classify') {
    const space = q.space;
    const p = 1 / space.length;
    return classifyProp(rubric, space.map((option) => ({ option, p })));
  }
  return evaluateProp(rubric, scores[rubric] ?? 0.5);
});

const decider = (overrides: Partial<DecideDeps> = {}) =>
  createDecider({
    judge: scriptedJudge({ groundedness: 0.9, relevance: 0.4, injection: 0.9, ambiguity: 0.2, plausibility: 0.6 }),
    embeddingCache: cache,
    ...overrides,
  });

describe('decide facade', () => {
  it('composes head verdicts, router band, contrastive, and provenance in one call', async () => {
    const result = await decider().decide({
      context: 'the cat sat on the mat',
      queries: [
        { kind: 'evaluate', instruction: 'g', rubric: 'groundedness', axis: 'epistemic' },
        { kind: 'evaluate', instruction: 'i', rubric: 'injection', axis: 'epistemic' },
        { kind: 'evaluate', instruction: 'a', rubric: 'ambiguity', axis: 'epistemic' },
      ],
      budget: BUDGET,
    });
    expect(result.verdicts).toHaveLength(3);
    expect(result.verdicts.map((v) => v.band)).toEqual(['act', 'act', 'block']);
    // Monotone-restrict: overall band is the most restrictive.
    expect(result.band).toBe('block');
    expect(result.provenance.inputDigest).toMatch(/^[0-9a-f]{64}$/);
    expect(result.provenance.fitted).toBe(true);
    expect(result.provenance.modelDigest).toBe('md5-digest');
    expect(result.abstained).toBe(false);
  });

  it('abstains when every head abstains, with a reason', async () => {
    const result = await decider({ judge: async (_p, qs) => qs.map(() => evaluateProp('groundedness', 0, true)) }).decide({
      context: 'anything',
      queries: [{ kind: 'evaluate', instruction: 'g', rubric: 'groundedness', axis: 'epistemic' }],
      budget: BUDGET,
    });
    expect(result.abstained).toBe(true);
    expect(result.abstainReason).toBe('all-heads-abstained');
    expect(result.band).toBe('abstain');
  });

  it('surfaces rubric-scoped contrastive penalty when exemplars exist', async () => {
    const memory = new ContrastiveMemory();
    await memory.add('groundedness', { positives: ['cat mat'], negatives: ['storm chaos'] }, cache);
    const result = await decider({ contrastive: memory }).decide({
      context: 'cat mat',
      queries: [{ kind: 'evaluate', instruction: 'g', rubric: 'groundedness', axis: 'epistemic' }],
      budget: BUDGET,
      contrastiveRubric: 'groundedness',
    });
    expect(result.contrastive.score).toBeDefined();
    expect(result.contrastive.penalty).toBeCloseTo(1 - result.contrastive.score!, 5);
  });

  it('chunks large query sets instead of truncating', async () => {
    const queries = Array.from({ length: 5 }, (_, i) => ({
      kind: 'evaluate' as const,
      instruction: `q${i}`,
      rubric: 'plausibility' as const,
      axis: 'epistemic' as const,
    }));
    const result = await decider({ maxBatchSize: 2 }).decide({ context: 'x', queries, budget: BUDGET });
    expect(result.verdicts).toHaveLength(5);
    expect(result.verdicts.every((v) => v.proposition)).toBe(true);
  });

  it('composite aggregates weighted non-abstained heads', async () => {
    const result = await decider().decide({
      context: 'x',
      queries: [
        { kind: 'evaluate', instruction: 'g', rubric: 'groundedness', axis: 'epistemic' },
        { kind: 'evaluate', instruction: 'r', rubric: 'relevance', axis: 'epistemic' },
      ],
      budget: BUDGET,
      weights: { groundedness: 1, relevance: 1 },
    });
    // (0.9 + 0.4) / 2
    expect(result.composite?.score).toBeCloseTo(0.65, 5);
  });
});

describe('choose', () => {
  it('returns penalized, re-normalized distribution and selected candidate', async () => {
    const memory = new ContrastiveMemory();
    await memory.add('domain', { negatives: ['bad bet'] }, cache);
    const d = decider({ contrastive: memory });
    const result = await d.choose({
      context: 'pick one',
      candidates: ['good move', 'bad bet'],
      budget: BUDGET,
    });
    expect(result.distribution).toHaveLength(2);
    const sum = result.distribution.reduce((s, d) => s + d.p, 0);
    expect(sum).toBeCloseTo(1, 5);
    // Ranked view is sorted by adjusted score descending (selection order).
    expect(result.ranked[0]!.option).toBe(result.selected);
    expect(result.ranked.every((d, i) => i === 0 || d.p <= result.ranked[i - 1]!.p)).toBe(true);
    // 'bad bet' is penalized toward zero; 'good move' wins.
    expect(result.selected).toBe('good move');
    expect(result.abstained).toBe(false);
    // Candidate-set digest lands in provenance.
    expect(result.provenance.inputDigest).toMatch(/^[0-9a-f]{64}$/);
  });

  it('vetoes candidates below the verification floor and abstains when all are vetoed', async () => {
    const memory = new ContrastiveMemory();
    await memory.add('domain', { negatives: ['good move', 'bad bet'] }, cache);
    const result = await decider({ contrastive: memory }).choose({
      context: 'pick one',
      candidates: ['good move', 'bad bet'],
      budget: BUDGET,
      verificationFloor: 0.99,
    });
    expect(result.contrastive.vetoes.length).toBeGreaterThan(0);
    expect(result.abstained).toBe(true);
    expect(result.selected).toBeUndefined();
  });

  it('abstains with no-candidates without judging', async () => {
    const result = await decider().choose({ context: 'x', candidates: [], budget: BUDGET });
    expect(result.abstained).toBe(true);
    expect(result.abstainReason).toBe('no-candidates');
    expect(result.distribution).toEqual([]);
  });
});
