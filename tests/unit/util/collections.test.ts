import { insertByScoreDesc, maxBy, minBy, sortBy, sortByDesc } from '@senars/util';
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

describe('insertByScoreDesc', () => {
  const score = (i: { n: number }) => i.n;

  it('keeps the list descending as items arrive out of order', () => {
    const items: { n: number }[] = [];
    for (const n of [3, 9, 1, 5, 9]) insertByScoreDesc(items, { n }, score);
    expect(items.map(score)).toEqual([9, 9, 5, 3, 1]);
  });

  it('appends when the item scores lowest', () => {
    const items = [{ n: 5 }, { n: 2 }];
    insertByScoreDesc(items, { n: 0 }, score);
    expect(items.map(score)).toEqual([5, 2, 0]);
  });

  it('prepends when the item scores highest', () => {
    const items = [{ n: 5 }, { n: 2 }];
    insertByScoreDesc(items, { n: 7 }, score);
    expect(items.map(score)).toEqual([7, 5, 2]);
  });

  it('agrees with a full sort on mixed input', () => {
    const input = [4, 1, 8, 8, 2, 9, 3];
    const items: { n: number }[] = [];
    for (const n of input) insertByScoreDesc(items, { n }, score);
    expect(items.map(score)).toEqual([...input].sort((a, b) => b - a));
  });
});
