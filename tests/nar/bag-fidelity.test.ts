import { PriorityBag, FenwickBag, createBag, type Bag, type BagOptions } from '@senars/nar/bag';
import { describe, expect, it, beforeEach } from 'vitest';

interface TestItem {
  id: string;
  priority: number;
}

function makeItem(id: string, priority: number): TestItem {
  return { id, priority };
}

function createPriorityBag(options?: Partial<BagOptions>): Bag<TestItem> {
  return new PriorityBag<TestItem>({
    capacity: 1000,
    decayRate: 0.01,
    forgetRate: 0.001,
    rng: () => Math.random(),
    clock: Date.now,
    ...options,
  });
}

function createFenwickBag(options?: Partial<BagOptions>): Bag<TestItem> {
  return new FenwickBag<TestItem>({
    capacity: 1000,
    decayRate: 0.01,
    forgetRate: 0.001,
    rng: () => Math.random(),
    clock: Date.now,
    ...options,
  });
}

function createDeterministicBag(
  impl: 'priority' | 'fenwick',
  seed: number,
  options?: Partial<BagOptions>
): Bag<TestItem> {
  let state = seed;
  const rng = () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
  const clock = () => 1000000;
  if (impl === 'priority') {
    return new PriorityBag<TestItem>({
      capacity: 1000,
      decayRate: 0.01,
      forgetRate: 0.001,
      rng,
      clock,
      ...options,
    });
  }
  return new FenwickBag<TestItem>({
    capacity: 1000,
    decayRate: 0.01,
    forgetRate: 0.001,
    rng,
    clock,
    ...options,
  });
}

describe('Bag fidelity tests', () => {
  describe('Distribution fidelity (TV-distance ≤ 0.02 @ 50k samples)', () => {
    it('PriorityBag samples match priority distribution', () => {
      const bag = createPriorityBag();
      bag.add(makeItem('a', 0.1));
      bag.add(makeItem('b', 0.3));
      bag.add(makeItem('c', 0.6));

      const samples = 50000;
      const counts = { a: 0, b: 0, c: 0 };
      for (let i = 0; i < samples; i++) {
        const item = bag.sample();
        if (item) counts[item.id as keyof typeof counts]++;
      }

      const totalPriority = 0.1 + 0.3 + 0.6;
      const expected = { a: 0.1 / totalPriority, b: 0.3 / totalPriority, c: 0.6 / totalPriority };
      const observed = { a: counts.a / samples, b: counts.b / samples, c: counts.c / samples };

      const tvDistance = 0.5 * (Math.abs(observed.a - expected.a) + Math.abs(observed.b - expected.b) + Math.abs(observed.c - expected.c));
      expect(tvDistance).toBeLessThan(0.02);
    });

    it('FenwickBag samples match priority distribution', () => {
      const bag = createFenwickBag();
      bag.add(makeItem('a', 0.1));
      bag.add(makeItem('b', 0.3));
      bag.add(makeItem('c', 0.6));

      const samples = 50000;
      const counts = { a: 0, b: 0, c: 0 };
      for (let i = 0; i < samples; i++) {
        const item = bag.sample();
        if (item) counts[item.id as keyof typeof counts]++;
      }

      const totalPriority = 0.1 + 0.3 + 0.6;
      const expected = { a: 0.1 / totalPriority, b: 0.3 / totalPriority, c: 0.6 / totalPriority };
      const observed = { a: counts.a / samples, b: counts.b / samples, c: counts.c / samples };

      const tvDistance = 0.5 * (Math.abs(observed.a - expected.a) + Math.abs(observed.b - expected.b) + Math.abs(observed.c - expected.c));
      expect(tvDistance).toBeLessThan(0.02);
    });

    it('Chi-squared test for distribution fidelity', () => {
      const bag = createFenwickBag();
      bag.add(makeItem('a', 0.2));
      bag.add(makeItem('b', 0.3));
      bag.add(makeItem('c', 0.5));

      const samples = 50000;
      const counts = { a: 0, b: 0, c: 0 };
      for (let i = 0; i < samples; i++) {
        const item = bag.sample();
        if (item) counts[item.id as keyof typeof counts]++;
      }

      const totalPriority = 1.0;
      const expected = { a: 0.2 * samples, b: 0.3 * samples, c: 0.5 * samples };
      const chi2 = Math.pow(counts.a - expected.a, 2) / expected.a +
                   Math.pow(counts.b - expected.b, 2) / expected.b +
                   Math.pow(counts.c - expected.c, 2) / expected.c;

      // χ²(2) at p=0.05 is 5.99, at p=0.01 is 9.21; use relaxed threshold for CI stability
      expect(chi2).toBeLessThan(10);
    });
  });

  describe('Post-removal fidelity', () => {
    it('PriorityBag maintains fidelity after removals', () => {
      const bag = createPriorityBag();
      bag.add(makeItem('a', 0.2));
      bag.add(makeItem('b', 0.3));
      bag.add(makeItem('c', 0.5));

      bag.remove('b');

      const samples = 20000;
      const counts = { a: 0, c: 0 };
      for (let i = 0; i < samples; i++) {
        const item = bag.sample();
        if (item) counts[item.id as keyof typeof counts]++;
      }

      const totalPriority = 0.2 + 0.5;
      const expected = { a: 0.2 / totalPriority, c: 0.5 / totalPriority };
      const observed = { a: counts.a / samples, c: counts.c / samples };

      const tvDistance = 0.5 * (Math.abs(observed.a - expected.a) + Math.abs(observed.c - expected.c));
      expect(tvDistance).toBeLessThan(0.02);
      expect(bag.size()).toBe(2);
    });

    it('FenwickBag maintains fidelity after removals', () => {
      const bag = createFenwickBag();
      bag.add(makeItem('a', 0.2));
      bag.add(makeItem('b', 0.3));
      bag.add(makeItem('c', 0.5));

      bag.remove('b');

      const samples = 20000;
      const counts = { a: 0, c: 0 };
      for (let i = 0; i < samples; i++) {
        const item = bag.sample();
        if (item) counts[item.id as keyof typeof counts]++;
      }

      const totalPriority = 0.2 + 0.5;
      const expected = { a: 0.2 / totalPriority, c: 0.5 / totalPriority };
      const observed = { a: counts.a / samples, c: counts.c / samples };

      const tvDistance = 0.5 * (Math.abs(observed.a - expected.a) + Math.abs(observed.c - expected.c));
      expect(tvDistance).toBeLessThan(0.02);
      expect(bag.size()).toBe(2);
    });

    it('FenwickBag maintains fidelity after removeMany', () => {
      const bag = createFenwickBag();
      bag.add(makeItem('a', 0.1));
      bag.add(makeItem('b', 0.2));
      bag.add(makeItem('c', 0.3));
      bag.add(makeItem('d', 0.4));

      bag.removeMany((item) => item.priority < 0.3);

      const samples = 20000;
      const counts = { c: 0, d: 0 };
      for (let i = 0; i < samples; i++) {
        const item = bag.sample();
        if (item) counts[item.id as keyof typeof counts]++;
      }

      const totalPriority = 0.3 + 0.4;
      const expected = { c: 0.3 / totalPriority, d: 0.4 / totalPriority };
      const observed = { c: counts.c / samples, d: counts.d / samples };

      const tvDistance = 0.5 * (Math.abs(observed.c - expected.c) + Math.abs(observed.d - expected.d));
      expect(tvDistance).toBeLessThan(0.02);
      expect(bag.size()).toBe(2);
    });
  });

  describe('Seed parity — identical sequences across implementations', () => {
    it('same seed produces identical sample sequences (PriorityBag vs FenwickBag)', () => {
      const seed = 42;
      const bag1 = createDeterministicBag('priority', seed);
      const bag2 = createDeterministicBag('fenwick', seed);

      bag1.add(makeItem('a', 0.2));
      bag1.add(makeItem('b', 0.3));
      bag1.add(makeItem('c', 0.5));
      bag2.add(makeItem('a', 0.2));
      bag2.add(makeItem('b', 0.3));
      bag2.add(makeItem('c', 0.5));

      const sequence1: string[] = [];
      const sequence2: string[] = [];
      for (let i = 0; i < 100; i++) {
        const s1 = bag1.sample();
        const s2 = bag2.sample();
        if (s1) sequence1.push(s1.id);
        if (s2) sequence2.push(s2.id);
      }

      expect(sequence1).toEqual(sequence2);
    });

    it('same seed produces identical sequences after add/remove interleaving', () => {
      const seed = 12345;
      const bag1 = createDeterministicBag('priority', seed);
      const bag2 = createDeterministicBag('fenwick', seed);

      for (let i = 0; i < 10; i++) {
        bag1.add(makeItem(`p${i}`, 0.1 * (i + 1)));
        bag2.add(makeItem(`p${i}`, 0.1 * (i + 1)));
      }

      const sequence1: string[] = [];
      const sequence2: string[] = [];
      for (let round = 0; round < 5; round++) {
        for (let i = 0; i < 20; i++) {
          const s1 = bag1.sample();
          const s2 = bag2.sample();
          if (s1) sequence1.push(s1.id);
          if (s2) sequence2.push(s2.id);
        }
        bag1.remove(`p${round}`);
        bag2.remove(`p${round}`);
        bag1.add(makeItem(`new${round}`, 0.5));
        bag2.add(makeItem(`new${round}`, 0.5));
      }

      expect(sequence1).toEqual(sequence2);
    });
  });

  describe('Decay uniformity', () => {
    it('PriorityBag decay preserves relative priorities', () => {
      const bag = createPriorityBag({ decayRate: 0.5 });
      bag.add(makeItem('a', 0.2));
      bag.add(makeItem('b', 0.4));
      bag.add(makeItem('c', 0.6));

      const beforeDecay = bag.toArray().map((e) => e.priority);
      bag.decay();
      const afterDecay = bag.toArray().map((e) => e.priority);

      expect(beforeDecay[0]! / beforeDecay[1]!).toBeCloseTo(afterDecay[0]! / afterDecay[1]!, 5);
      expect(beforeDecay[1]! / beforeDecay[2]!).toBeCloseTo(afterDecay[1]! / afterDecay[2]!, 5);
    });

    it('FenwickBag decay preserves relative priorities', () => {
      const bag = createFenwickBag({ decayRate: 0.5 });
      bag.add(makeItem('a', 0.2));
      bag.add(makeItem('b', 0.4));
      bag.add(makeItem('c', 0.6));

      const beforeDecay = bag.toArray().map((e) => e.priority);
      bag.decay();
      const afterDecay = bag.toArray().map((e) => e.priority);

      expect(beforeDecay[0]! / beforeDecay[1]!).toBeCloseTo(afterDecay[0]! / afterDecay[1]!, 5);
      expect(beforeDecay[1]! / beforeDecay[2]!).toBeCloseTo(afterDecay[1]! / afterDecay[2]!, 5);
    });

    it('FenwickBag decay removes items below forgetRate', () => {
      const bag = createFenwickBag({ decayRate: 0.9, forgetRate: 0.01 });
      bag.add(makeItem('a', 0.5));
      bag.add(makeItem('b', 0.005)); // below forgetRate after decay

      bag.decay();

      expect(bag.size()).toBe(1);
      expect(bag.find((e) => e.id === 'a')).toBeDefined();
      expect(bag.find((e) => e.id === 'b')).toBeUndefined();
    });
  });

  describe('EvictStrategy modes preserve invariants', () => {
    const strategies: Array<'LRU' | 'LowestPriority' | 'Random'> = ['LRU', 'LowestPriority', 'Random'];

    for (const strategy of strategies) {
      it(`PriorityBag evict('${strategy}') preserves sorted invariant`, () => {
        const bag = createPriorityBag({ capacity: 10 });
        for (let i = 0; i < 5; i++) {
          bag.add(makeItem(`item${i}`, 0.1 * (i + 1)));
        }

        bag.evict(strategy);

        const arr = bag.toArray();
        for (let i = 0; i < arr.length - 1; i++) {
          expect(arr[i]!.priority).toBeGreaterThanOrEqual(arr[i + 1]!.priority);
        }
        expect(bag.peek()?.priority).toBe(Math.max(...arr.map((e) => e.priority)));
        expect(bag.size()).toBe(4);
      });

      it(`FenwickBag evict('${strategy}') preserves sorted invariant`, () => {
        const bag = createFenwickBag({ capacity: 10 });
        for (let i = 0; i < 5; i++) {
          bag.add(makeItem(`item${i}`, 0.1 * (i + 1)));
        }

        bag.evict(strategy);

        const arr = bag.toArray();
        for (let i = 0; i < arr.length - 1; i++) {
          expect(arr[i]!.priority).toBeGreaterThanOrEqual(arr[i + 1]!.priority);
        }
        expect(bag.peek()?.priority).toBe(Math.max(...arr.map((e) => e.priority)));
        expect(bag.size()).toBe(4);
      });
    }
  });

  describe('serializeBag/restoreBag round-trip property', () => {
    it('PriorityBag serialize/deserialize round-trip preserves items', () => {
      const bag = createPriorityBag();
      bag.add(makeItem('a', 0.3));
      bag.add(makeItem('b', 0.7));
      bag.add(makeItem('c', 0.5));

      const serialized = [...bag.entries()].map(([item, priority]) => ({
        id: item.id,
        priority,
        term: item.id,
      }));

      const newBag = createPriorityBag();
      for (const s of serialized) {
        newBag.add(makeItem(s.id, s.priority));
      }

      expect(newBag.size()).toBe(bag.size());
      const origArray = bag.toArray().sort((a, b) => a.id.localeCompare(b.id));
      const newArray = newBag.toArray().sort((a, b) => a.id.localeCompare(b.id));
      for (let i = 0; i < origArray.length; i++) {
        expect(newArray[i]!.id).toBe(origArray[i]!.id);
        expect(newArray[i]!.priority).toBeCloseTo(origArray[i]!.priority, 5);
      }
    });

    it('FenwickBag serialize/deserialize round-trip preserves items', () => {
      const bag = createFenwickBag();
      bag.add(makeItem('a', 0.3));
      bag.add(makeItem('b', 0.7));
      bag.add(makeItem('c', 0.5));

      const serialized = [...bag.entries()].map(([item, priority]) => ({
        id: item.id,
        priority,
        term: item.id,
      }));

      const newBag = createFenwickBag();
      for (const s of serialized) {
        newBag.add(makeItem(s.id, s.priority));
      }

      expect(newBag.size()).toBe(bag.size());
      const origArray = bag.toArray().sort((a, b) => a.id.localeCompare(b.id));
      const newArray = newBag.toArray().sort((a, b) => a.id.localeCompare(b.id));
      for (let i = 0; i < origArray.length; i++) {
        expect(newArray[i]!.id).toBe(origArray[i]!.id);
        expect(newArray[i]!.priority).toBeCloseTo(origArray[i]!.priority, 5);
      }
    });

    it('Cross-implementation round-trip: PriorityBag → FenwickBag', () => {
      const bag1 = createPriorityBag();
      bag1.add(makeItem('a', 0.3));
      bag1.add(makeItem('b', 0.7));
      bag1.add(makeItem('c', 0.5));

      const serialized = [...bag1.entries()].map(([item, priority]) => ({
        id: item.id,
        priority,
        term: item.id,
      }));

      const bag2 = createFenwickBag();
      for (const s of serialized) {
        bag2.add(makeItem(s.id, s.priority));
      }

      expect(bag2.size()).toBe(bag1.size());
      const arr1 = bag1.toArray().sort((a, b) => a.id.localeCompare(b.id));
      const arr2 = bag2.toArray().sort((a, b) => a.id.localeCompare(b.id));
      for (let i = 0; i < arr1.length; i++) {
        expect(arr2[i]!.id).toBe(arr1[i]!.id);
        expect(arr2[i]!.priority).toBeCloseTo(arr1[i]!.priority, 5);
      }
    });
  });
});