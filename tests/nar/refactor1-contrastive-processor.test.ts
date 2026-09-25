import { ContrastiveMemory } from '@senars/nar/lm/system-one/contrastive.js';
import { describe, expect, it } from 'vitest';

/** Family-consistent unit vector: `<family>` sets the direction, the suffix jitters it. */
const directional = (label: string, dim = 16): Float32Array => {
  const family = label.split('-')[0]!;
  const v = new Float32Array(dim);
  for (let d = 0; d < dim; d++) {
    v[d] = Math.sin(d * 0.7 + family.charCodeAt(0) * 0.13 + d * family.length * 0.31);
  }
  const jitter = (label.charCodeAt(label.length - 1) % 7) * 0.01;
  for (let d = 0; d < dim; d++) v[d] = v[d]! + jitter;
  let norm = 0;
  for (const x of v) norm += x * x;
  for (let d = 0; d < dim; d++) v[d] = v[d]! / Math.sqrt(norm || 1);
  return v;
};

describe('Bench 83 — ContrastiveMemory as AIKR process', () => {
  it('judgments auto-admit only above the confidence threshold (pending bag)', () => {
    const memory = new ContrastiveMemory({ maxPerRubric: 8 });
    const emb = directional('judgment');
    expect(memory.observeJudgment('domain', emb, { label: 'pos', confidence: 0.5 })).toBe(false);
    expect(memory.observeJudgment('domain', emb, { label: 'pos', confidence: 0.95 })).toBe(true);
    // Pending, not yet promoted: the exemplar pool is still empty.
    expect(memory.isEmpty()).toBe(true);
  });

  it('pending judgments promote under pressure (40/60 pool self-balance)', async () => {
    const memory = new ContrastiveMemory({ maxPerRubric: 10, positiveShare: 0.6 });
    for (let i = 0; i < 4; i++)
      memory.observeJudgment('domain', directional(`pos-family-${i}`), {
        label: 'pos',
        confidence: 0.95,
      });
    for (let i = 0; i < 3; i++)
      memory.observeJudgment('domain', directional(`neg-family-${i}`), {
        label: 'neg',
        confidence: 0.95,
      });
    // pending cap 64: 7 items → pressure ~0.11, below 0.7 — inert.
    expect(await memory.maintainIfPressured()).toBe(0);
    for (let i = 0; i < 60; i++)
      memory.observeJudgment('domain', directional(`bulk-${i}`), {
        label: i % 2 === 0 ? 'pos' : 'neg',
        confidence: 0.9,
      });
    const promoted = await memory.maintainIfPressured({ budget: 16 });
    expect(promoted).toBeGreaterThan(0);
    const stats = memory.stats().domain!;
    // Pool self-balances to the 40/60 target via capacity eviction.
    expect(stats.positives).toBeLessThanOrEqual(6);
    expect(stats.negatives).toBeLessThanOrEqual(4);
    expect(stats.positives).toBeGreaterThan(0);
    expect(stats.negatives).toBeGreaterThan(0);
  });

  it('decay erodes stale exemplar priority and forgets below the floor', async () => {
    const memory = new ContrastiveMemory({ maxPerRubric: 4 });
    for (let i = 0; i < 80; i++)
      memory.observeJudgment('domain', directional(`fill-${i}`), {
        label: 'pos',
        confidence: 0.95,
      });
    await memory.maintainIfPressured({ budget: 4 });
    const before = memory.stats().domain!.positives;
    memory.decay(0.99);
    const after = memory.stats().domain!.positives;
    expect(after).toBeLessThan(before);
  });

  it('admission preserves discrimination: promoted exemplars score correctly', async () => {
    const memory = new ContrastiveMemory({ maxPerRubric: 6 });
    for (let i = 0; i < 40; i++)
      memory.observeJudgment('domain', directional(`pos-${i}`), { label: 'pos', confidence: 0.95 });
    for (let i = 0; i < 40; i++)
      memory.observeJudgment('domain', directional(`neg-${i}`), { label: 'neg', confidence: 0.95 });
    await memory.maintainIfPressured({ budget: 8 });
    const posScore = memory.score(directional('pos-unseen'), 'domain');
    const negScore = memory.score(directional('neg-unseen'), 'domain');
    expect(posScore).toBeGreaterThan(negScore!);
  });
});
