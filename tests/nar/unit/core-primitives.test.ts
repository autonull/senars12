import {
  addToSet,
  getOrInsert,
  incrementCount,
  maxBy,
  minBy,
  mulberry32,
  removeFromSet,
  selectByPriority,
  shuffleInPlace,
} from '@senars/util';
import { describe, expect, it } from 'vitest';
import { schedulerReward } from '../../../nar/src/focus/scheduler-reward.js';
import { TermBuilder, TermMap } from '../../../nar/src/terms';

const items = [
  { id: 'b', priority: 2 },
  { id: 'a', priority: 2 },
  { id: 'c', priority: 5 },
  { id: 'd', priority: 1 },
];

describe('shuffleInPlace', () => {
  it('is a permutation and is deterministic per rng', () => {
    const source = [1, 2, 3, 4, 5, 6, 7, 8];
    const a = shuffleInPlace([...source], mulberry32(7));
    const b = shuffleInPlace([...source], mulberry32(7));
    expect(a).toEqual(b);
    expect([...a].sort((x, y) => x - y)).toEqual(source);
  });

  it('actually reorders and leaves tiny inputs intact', () => {
    const shuffled = shuffleInPlace([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], mulberry32(1));
    expect(shuffled).not.toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(shuffleInPlace([], mulberry32(1))).toEqual([]);
    expect(shuffleInPlace([42], mulberry32(1))).toEqual([42]);
  });
});

describe('schedulerReward', () => {
  it('clamps derivation rate onto [-1, 1] and scores idle ticks as 0', () => {
    const report = (derivations: number, tasksProcessed: number) =>
      ({ derivations, tasksProcessed }) as never;
    expect(schedulerReward(report(0, 0))).toBe(0);
    expect(schedulerReward(report(1, 1))).toBe(1);
    expect(schedulerReward(report(0, 1))).toBe(-1);
    expect(schedulerReward(report(3, 2))).toBe(1);
    expect(schedulerReward(report(5, 20))).toBe(-0.5);
    expect(schedulerReward(report(1, 2))).toBe(0);
  });
});

describe('extremum picks', () => {
  it('minBy/maxBy honour an initial floor', () => {
    const score = (x: { priority: number }) => x.priority;
    expect(maxBy(items, score)).toEqual(items[2]);
    expect(maxBy(items, score, items[0], 0)).toEqual(items[2]);
    expect(maxBy(items, score, items[0], 99)).toBe(items[0]);
    expect(minBy(items, score)).toEqual(items[3]);
    expect(maxBy([], score)).toBeUndefined();
  });
});

describe('selectByPriority', () => {
  it('orders by priority then id and caps at the budget', () => {
    expect(selectByPriority(items, 3).map((i) => i.id)).toEqual(['c', 'a', 'b']);
    expect(selectByPriority(items, 0)).toEqual([]);
    expect(selectByPriority(items, 9).map((i) => i.id)).toEqual(['c', 'a', 'b', 'd']);
  });

  it('applies the eligibility predicate before the budget', () => {
    expect(selectByPriority(items, 1, (i) => i.priority < 5).map((i) => i.id)).toEqual(['a']);
  });
});

describe('map helpers', () => {
  it('getOrInsert creates once and returns the same value', () => {
    const map = new Map<string, number[]>();
    const first = getOrInsert(map, 'k', () => []);
    first.push(1);
    expect(getOrInsert(map, 'k', () => [])).toBe(first);
    expect(map.get('k')).toEqual([1]);
  });

  it('incrementCount accumulates deltas', () => {
    const counts = new Map<string, number>();
    expect(incrementCount(counts, 'a')).toBe(1);
    expect(incrementCount(counts, 'a')).toBe(2);
    expect(incrementCount(counts, 'a', -1)).toBe(1);
    expect(counts.get('b')).toBeUndefined();
  });

  it('addToSet unions per key', () => {
    const sets = new Map<string, Set<number>>();
    addToSet(sets, 'a', 1);
    addToSet(sets, 'a', 1);
    addToSet(sets, 'a', 2);
    expect(sets.get('a')).toEqual(new Set([1, 2]));
  });

  it('addToSet/removeFromSet key structurally, not by Map', () => {
    const sets = new TermMap<Set<string>>();
    const key = TermBuilder.atom('a');
    addToSet(sets, key, 'x');
    addToSet(sets, TermBuilder.atom('a'), 'x');
    expect(sets.get(key)).toEqual(new Set(['x']));

    removeFromSet(sets, key, 'x');
    expect(sets.has(key)).toBe(false);
  });

  it('removeFromSet leaves a non-empty bucket and forgets an absent one', () => {
    const sets = new Map<string, Set<number>>();
    addToSet(sets, 'a', 1);
    addToSet(sets, 'a', 2);

    removeFromSet(sets, 'a', 1);
    expect(sets.get('a')).toEqual(new Set([2]));
    expect(() => removeFromSet(sets, 'missing', 1)).not.toThrow();

    removeFromSet(sets, 'a', 2);
    expect(sets.has('a')).toBe(false);
  });
});
