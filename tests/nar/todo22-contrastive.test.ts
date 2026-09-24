import { describe, expect, it } from 'vitest';
import {
  ContrastiveMemory,
  cosineF32,
  fitInfoNCE,
  rubricOf,
} from '../../nar/src/lm/system-one/contrastive.js';
import { createEmbeddingCache } from '../../nar/src/lm/system-one/embedding-cache.js';
import {
  mineHardNegatives,
  seedContrastiveMemory,
} from '../../nar/src/lm/system-one/hard-negatives.js';
import type { JudgmentQuery } from '../../nar/src/lm/system-one/types.js';

const dim = 32;

/** Deterministic embedding: per-word directions summed + normalized, so texts
 *  sharing words cluster (bag-of-words geometry — enough for cosine tests). */
const directional = (text: string): Float32Array => {
  const v = new Float32Array(dim);
  for (const word of text.toLowerCase().split(/\W+/).filter(Boolean)) {
    const seed = word.split('').reduce((h, c) => h * 31 + c.charCodeAt(0), 7);
    for (let i = 0; i < dim; i++) v[i]! += Math.sin(seed * 0.1 + i);
  }
  const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1;
  return v.map((x) => x / norm);
};

/** Mock generator so tests never load transformers. */
const cache = createEmbeddingCache({
  maxSize: 100,
  generator: { generate: async (text: string) => [...directional(text)] },
});

const evaluateQuery = (rubric = 'groundedness'): JudgmentQuery => ({
  kind: 'evaluate',
  instruction: 'test',
  rubric: rubric as never,
  axis: 'epistemic',
});

describe('contrastive core', () => {
  it('cosineF32 is 1 for identical, 0 for zero vectors', () => {
    const v = directional('a');
    expect(cosineF32(v, v)).toBeCloseTo(1, 5);
    expect(cosineF32(v, new Float32Array(dim))).toBe(0);
  });

  it('rubricOf resolves classify default and evaluate rubric', () => {
    expect(rubricOf({ kind: 'classify', instruction: 'x', space: ['a'], axis: 'epistemic' })).toBe(
      'task_type'
    );
    expect(rubricOf(evaluateQuery('risk'))).toBe('risk');
  });

  it('fitInfoNCE separates positives from negatives', () => {
    const posDir = directional('alpha alpha alpha');
    const negDir = directional('omega omega omega');
    const pairs = [0, 1, 2].map((i) => {
      const q = directional(`alpha variant ${i}`);
      return { query: q, positive: posDir, negatives: [negDir] };
    });
    const fit = fitInfoNCE(pairs, { epochs: 200 });
    expect(fit.loss).toBeLessThan(0.3);
    // Positive similarity must outscore negative under the learned logits.
    const q = directional('alpha unseen');
    const logitPos = fit.scale * cosineF32(q, posDir) + fit.bias;
    const logitNeg = fit.scale * cosineF32(q, negDir) + fit.bias;
    expect(logitPos).toBeGreaterThan(logitNeg);
  });

  it('ContrastiveMemory stores, scores, calibrates and caps per replay mix', async () => {
    const memory = new ContrastiveMemory({ maxPerRubric: 5, positiveShare: 0.6 });
    const positives = ['sunny meadow', 'sunny meadow walks', 'sunny meadow breeze', 'sunny meadow birds'];
    const negatives = ['dark storm', 'dark storm thunder'];
    expect(await memory.add('groundedness', { positives, negatives }, cache)).toBe(6);

    const stats = memory.stats().groundedness!;
    expect(stats.positives).toBe(3); // 5 * 0.6 → 3
    expect(stats.negatives).toBe(2);

    // Zero-shot: a positive-family text scores above a negative-family text.
    const posScore = memory.score(directional('sunny meadow day'), 'groundedness');
    const negScore = memory.score(directional('dark storm night'), 'groundedness');
    expect(posScore).toBeDefined();
    expect(negScore).toBeDefined();
    expect(posScore!).toBeGreaterThan(negScore!);

    // Calibration requires both classes and yields a fitted rubric.
    const calibrated = memory.calibrate('groundedness');
    expect(calibrated).toBeDefined();
    expect(memory.stats().groundedness!.calibrated).toBe(true);

    // Uncalibratable: no negatives.
    await memory.add('relevance', { positives: ['relevant topic'] }, cache);
    expect(memory.calibrate('relevance')).toBeUndefined();

    // Empty rubric → undefined score.
    expect(memory.score(directional('anything'), 'novelty')).toBeUndefined();
  });

  it('routingScore measures in-domain-ness and clear() resets', async () => {
    const memory = new ContrastiveMemory();
    expect(memory.isEmpty()).toBe(true);
    expect(memory.routingScore(directional('x'))).toBeUndefined();
    await memory.add('domain', { positives: ['in domain text'] }, cache);
    expect(memory.isEmpty()).toBe(false);
    expect(memory.routingScore(directional('in domain text'))!).toBeGreaterThan(0.99);
    memory.clear();
    expect(memory.isEmpty()).toBe(true);
  });
});

describe('hard-negative mining', () => {
  const makeNar = (beliefs: { term: { toString(): string }; truth: { f: number } }[]) =>
    ({ getBeliefs: () => beliefs }) as never;

  it('mines contradiction pairs from divergent beliefs', async () => {
    const nar = makeNar([
      { term: { toString: () => 'robin --> fly' }, truth: { f: 0.9 } },
      { term: { toString: () => 'robin --> fly' }, truth: { f: 0.1 } },
      { term: { toString: () => 'cats --> mammals' }, truth: { f: 0.95 } },
      { term: { toString: () => 'cats --> mammals' }, truth: { f: 0.9 } },
    ]);
    const mined = await mineHardNegatives(nar, undefined);
    expect(mined).toHaveLength(1);
    expect(mined[0]).toMatchObject({ rubric: 'conflict', source: 'contradiction' });
  });

  it('mines error episodes from episodic memory', async () => {
    const episodic = {
      getEpisodes: async ({ type, limit }: { type?: string; limit?: number }) =>
        type === 'error'
          ? [
              { timestamp: 1, type: 'error', content: 'tool deploy failed', metadata: {} },
            ].slice(0, limit ?? 10)
          : [],
    } as never;
    const nar = makeNar([]);
    const mined = await mineHardNegatives(nar, episodic, { limit: 8 });
    expect(mined).toHaveLength(1);
    expect(mined[0]).toMatchObject({ rubric: 'groundedness', source: 'error-episode' });
  });

  it('seedContrastiveMemory groups negatives by rubric', async () => {
    const memory = new ContrastiveMemory();
    const added = await seedContrastiveMemory(
      [
        { rubric: 'conflict', text: 'bad belief a', source: 'contradiction' },
        { rubric: 'conflict', text: 'bad belief a', source: 'contradiction' }, // dup
        { rubric: 'groundedness', text: 'bad narration', source: 'error-episode' },
      ],
      memory,
      cache
    );
    expect(added).toBe(2);
    expect(memory.stats().conflict!.negatives).toBe(1);
    expect(memory.stats().groundedness!.negatives).toBe(1);
  });
});
