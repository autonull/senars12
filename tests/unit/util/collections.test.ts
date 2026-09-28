import { maxBy, minBy, sortBy, sortByDesc } from '@senars/util';
import { describe, expect, it } from 'vitest';

describe('minBy', () => {
  it('picks the lowest-scored item', () => {
    expect(minBy([{ n: 3 }, { n: 1 }, { n: 2 }], (i) => i.n)).toEqual({ n: 1 });
  });

  it('returns undefined for an empty collection', () => {
    expect(minBy([], () => 0)).toBeUndefined();
  });
});

describe('maxBy', () => {
  it('picks the highest-scored item', () => {
    expect(maxBy([{ n: 3 }, { n: 9 }, { n: 2 }], (i) => i.n)).toEqual({ n: 9 });
  });

  it('handles negative-only scores', () => {
    expect(maxBy([-5, -9], (n) => n)).toBe(-5);
  });
});

describe('sortBy / sortByDesc', () => {
  it('sort ascending and descending without mutating the input', () => {
    const input = [3, 1, 2];
    expect(sortBy(input, (n) => n)).toEqual([1, 2, 3]);
    expect(sortByDesc(input, (n) => n)).toEqual([3, 2, 1]);
    expect(input).toEqual([3, 1, 2]);
  });

  it('accepts any iterable', () => {
    expect(sortByDesc(new Set([1, 4, 2]), (n) => n)).toEqual([4, 2, 1]);
  });
});
