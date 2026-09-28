import { mulberry32, weightedSample, weightedSampleBy } from '@senars/nar/utils/random';
import { describe, expect, it } from 'vitest';

const items = [
  { id: 'a', weight: 1 },
  { id: 'b', weight: 3 },
  { id: 'c', weight: 0 },
];
const entries = items.map((i) => ({ item: i, weight: i.weight }));

describe('weightedSampleBy', () => {
  it('never repeats an item and never selects a zero-weight item', () => {
    const picked = weightedSampleBy(entries, 10, mulberry32(7));
    expect(new Set(picked.map((p) => p.id))).toEqual(new Set(['a', 'b']));
  });

  it('falls back to source order when every weight is zero', () => {
    const zeroed = items.map((i) => ({ item: i.id, weight: 0 }));
    expect(weightedSampleBy(zeroed, 2, mulberry32(1))).toEqual(['a', 'b']);
  });

  it('is deterministic for a given seed', () => {
    const pool = Array.from({ length: 20 }, (_, n) => ({ item: n, weight: (n % 5) + 1 }));
    expect(weightedSampleBy(pool, 8, mulberry32(42))).toEqual(
      weightedSampleBy(pool, 8, mulberry32(42))
    );
  });
});

describe('weightedSample', () => {
  it('favours heavy items across many draws', () => {
    const rng = mulberry32(99);
    let heavy = 0;
    for (let trial = 0; trial < 200; trial++) {
      heavy += weightedSample(items, 1, (i) => i.weight, rng)[0]?.id === 'b' ? 1 : 0;
    }
    expect(heavy).toBeGreaterThan(120);
  });

  it('returns an empty sample for a non-positive count', () => {
    expect(weightedSample(items, 0, (i) => i.weight, mulberry32(3))).toEqual([]);
  });
});
