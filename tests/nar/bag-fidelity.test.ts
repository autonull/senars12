import { type Bag, type BagOptions, PriorityBag } from '@senars/nar/bag';
import { describe, expect, it } from 'vitest';
import { createLCG } from '../helpers/rng.js';

interface TestItem {
  id: string;
  priority: number;
}

function makeItem(id: string, priority: number): TestItem {
  return { id, priority };
}

const makeBag = (options?: Partial<BagOptions>): Bag<TestItem> =>
  new PriorityBag<TestItem>({
    capacity: 1000,
    decayRate: 0.01,
    forgetRate: 0.001,
    rng: () => Math.random(),
    clock: Date.now,
    ...options,
  });

const seededBag = (seed: number, options?: Partial<BagOptions>): Bag<TestItem> =>
  makeBag({ rng: createLCG(seed), clock: () => 1_000_000, ...options });

/** Draw `samples` times and report how often each id came up. */
const observe = (bag: Bag<TestItem>, samples: number): Record<string, number> => {
  const counts: Record<string, number> = {};
  for (let i = 0; i < samples; i++) {
    const item = bag.sample();
    if (item) counts[item.id] = (counts[item.id] ?? 0) + 1;
  }
  return counts;
};

/** Total-variation distance between observed frequencies and priority-proportional ones. */
const tvDistance = (
  counts: Record<string, number>,
  priorities: Record<string, number>,
  samples: number
): number => {
  const total = Object.values(priorities).reduce((a, b) => a + b, 0);
  return (
    0.5 *
    Object.keys(priorities).reduce(
      (sum, id) => sum + Math.abs((counts[id] ?? 0) / samples - priorities[id]! / total),
      0
    )
  );
};

const populate = (bag: Bag<TestItem>, entries: Record<string, number>): void => {
  for (const [id, priority] of Object.entries(entries)) bag.add(makeItem(id, priority));
};

const sortedIds = (bag: Bag<TestItem>): string[] => bag.toArray().map((i) => i.id);

describe('Bag fidelity tests @load-sensitive', () => {
  describe('Distribution fidelity (TV-distance ≤ 0.02 @ 50k samples)', () => {
    it('samples match the priority distribution', () => {
      const bag = makeBag();
      populate(bag, { a: 0.1, b: 0.3, c: 0.6 });

      const samples = 50000;
      expect(tvDistance(observe(bag, samples), { a: 0.1, b: 0.3, c: 0.6 }, samples)).toBeLessThan(
        0.02
      );
    });

    it('Chi-squared test for distribution fidelity', () => {
      const bag = makeBag();
      const priorities = { a: 0.2, b: 0.3, c: 0.5 };
      populate(bag, priorities);

      const samples = 50000;
      const counts = observe(bag, samples);
      const chi2 = Object.entries(priorities).reduce(
        (sum, [id, p]) => sum + (counts[id]! - p * samples) ** 2 / (p * samples),
        0
      );

      // χ²(2) at p=0.05 is 5.99, at p=0.01 is 9.21; use relaxed threshold for CI stability
      expect(chi2).toBeLessThan(10);
    });
  });

  describe('Post-removal fidelity', () => {
    it('maintains fidelity after a removal', () => {
      const bag = makeBag();
      populate(bag, { a: 0.2, b: 0.3, c: 0.5 });
      bag.remove('b');

      const samples = 20000;
      expect(tvDistance(observe(bag, samples), { a: 0.2, c: 0.5 }, samples)).toBeLessThan(0.02);
      expect(bag.size()).toBe(2);
    });

    it('maintains fidelity after removeMany', () => {
      const bag = makeBag();
      populate(bag, { a: 0.1, b: 0.2, c: 0.3, d: 0.4 });
      bag.removeMany((item) => item.priority < 0.3);

      const samples = 20000;
      expect(tvDistance(observe(bag, samples), { c: 0.3, d: 0.4 }, samples)).toBeLessThan(0.02);
      expect(bag.size()).toBe(2);
    });

    it('is unaffected by insert position — append, prepend and middle splices alike', () => {
      // Three bags holding the same priorities, each built through a different
      // tree mutation path, must sample identically in distribution.
      const priorities = { a: 0.2, b: 0.3, c: 0.5 };
      const samples = 20000;
      const byAppend = makeBag();
      const byPrepend = makeBag();
      const byMiddle = makeBag();

      populate(byAppend, priorities);
      populate(byPrepend, { c: 0.5, b: 0.3, a: 0.2 });
      byMiddle.add(makeItem('a', 0.2));
      byMiddle.add(makeItem('c', 0.5));
      byMiddle.add(makeItem('b', 0.3));

      for (const bag of [byAppend, byPrepend, byMiddle]) {
        expect(tvDistance(observe(bag, samples), priorities, samples)).toBeLessThan(0.02);
        expect(sortedIds(bag)).toEqual(['c', 'b', 'a']);
      }
    });

    it('a removed id cannot be found again, and a live one still can', () => {
      const bag = makeBag();
      populate(bag, { a: 0.2, b: 0.3, c: 0.5 });
      expect(bag.remove('b')).toBe(true);
      expect(bag.remove('b')).toBe(false);
      expect(bag.remove('nope')).toBe(false);
      expect(bag.find((i) => i.id === 'b')).toBeUndefined();
      expect(bag.find((i) => i.id === 'c')).toBeDefined();
    });
  });

  describe('Seed parity — a seed replays a sequence', () => {
    it('the same seed produces the same sample sequence', () => {
      const bag1 = seededBag(42);
      const bag2 = seededBag(42);
      populate(bag1, { a: 0.2, b: 0.3, c: 0.5 });
      populate(bag2, { a: 0.2, b: 0.3, c: 0.5 });

      const draw = (bag: Bag<TestItem>, n: number): string[] =>
        Array.from({ length: n }, () => bag.sample()?.id).filter((id): id is string => !!id);

      expect(draw(bag1, 100)).toEqual(draw(bag2, 100));
    });

    it('the same seed replays identically across add/remove interleaving', () => {
      const bag1 = seededBag(12345);
      const bag2 = seededBag(12345);
      const sequence1: string[] = [];
      const sequence2: string[] = [];

      for (let i = 0; i < 10; i++) populate(bag1, { [`p${i}`]: 0.1 * (i + 1) });
      for (let i = 0; i < 10; i++) populate(bag2, { [`p${i}`]: 0.1 * (i + 1) });

      for (let round = 0; round < 5; round++) {
        for (let i = 0; i < 20; i++) {
          const s1 = bag1.sample();
          const s2 = bag2.sample();
          if (s1) sequence1.push(s1.id);
          if (s2) sequence2.push(s2.id);
        }
        for (const bag of [bag1, bag2]) {
          bag.remove(`p${round}`);
          bag.add(makeItem(`new${round}`, 0.5));
        }
      }

      expect(sequence1).toEqual(sequence2);
    });

    it('a different seed diverges, so the parity above is not a constant sequence', () => {
      const bag = seededBag(42);
      populate(bag, { a: 0.1, b: 0.3, c: 0.6 });
      const first = Array.from({ length: 100 }, () => bag.sample()?.id).join('');

      const other = seededBag(4242);
      populate(other, { a: 0.1, b: 0.3, c: 0.6 });
      const second = Array.from({ length: 100 }, () => other.sample()?.id).join('');

      expect(first).not.toBe(second);
    });
  });

  describe('Decay uniformity', () => {
    it('decay preserves relative priorities', () => {
      const bag = makeBag({ decayRate: 0.5 });
      populate(bag, { a: 0.2, b: 0.4, c: 0.6 });

      const before = bag.toArray().map((e) => e.priority);
      bag.decay();
      const after = bag.toArray().map((e) => e.priority);

      expect(before[0]! / before[1]!).toBeCloseTo(after[0]! / after[1]!, 5);
      expect(before[1]! / before[2]!).toBeCloseTo(after[1]! / after[2]!, 5);
    });

    it('decay removes items below forgetRate', () => {
      const bag = makeBag({ decayRate: 0.9, forgetRate: 0.01 });
      populate(bag, { a: 0.5, b: 0.005 });

      bag.decay();

      expect(bag.size()).toBe(1);
      expect(bag.find((e) => e.id === 'a')).toBeDefined();
      expect(bag.find((e) => e.id === 'b')).toBeUndefined();
    });
  });

  describe('EvictStrategy modes preserve invariants', () => {
    for (const strategy of ['LRU', 'LowestPriority', 'Random'] as const) {
      it(`evict('${strategy}') preserves sorted invariant`, () => {
        const bag = makeBag({ capacity: 10 });
        for (let i = 0; i < 5; i++) bag.add(makeItem(`item${i}`, 0.1 * (i + 1)));

        bag.evict(strategy);

        const arr = bag.toArray();
        for (let i = 0; i < arr.length - 1; i++) {
          expect(arr[i]!.priority).toBeGreaterThanOrEqual(arr[i + 1]!.priority);
        }
        expect(bag.peek()?.priority).toBe(Math.max(...arr.map((e) => e.priority)));
        expect(bag.size()).toBe(4);
      });
    }

    it('capacity is enforced by evicting the lowest-priority tail, not by growing', () => {
      const bag = makeBag({ capacity: 3 });
      populate(bag, { a: 0.9, b: 0.5, c: 0.1 });
      expect(bag.add(makeItem('d', 0.3))).toBe(true);
      expect(sortedIds(bag)).toEqual(['a', 'b', 'd']);
      expect(bag.add(makeItem('e', 0.2))).toBe(false);
      expect(bag.size()).toBe(3);
    });
  });

  describe('entries()/toArray() round-trip', () => {
    it('a serialized bag rebuilds to the same items and priorities', () => {
      const bag = makeBag();
      populate(bag, { a: 0.3, b: 0.7, c: 0.5 });

      const serialized = [...bag.entries()].map(([item, priority]) => ({ id: item.id, priority }));
      const restored = makeBag();
      populate(restored, Object.fromEntries(serialized.map((s) => [s.id, s.priority])));

      const byId = (b: Bag<TestItem>) =>
        b
          .toArray()
          .sort((x, y) => x.id.localeCompare(y.id))
          .map((i) => ({ ...i }));
      expect(byId(restored)).toEqual(byId(bag));
    });
  });
});
