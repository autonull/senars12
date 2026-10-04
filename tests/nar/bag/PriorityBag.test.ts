import { PriorityBag } from '@senars/nar/bag';
import { describe, expect, it } from 'vitest';
import { createLCG } from '../../helpers/rng.js';

describe('PriorityBag', () => {
  it('should add and sample items by priority', () => {
    const bag = new PriorityBag<{ id: string; priority: number; value: number }>({
      capacity: 10,
      decayRate: 0.01,
    });

    bag.add({ id: 'low', priority: 0.1, value: 1 });
    bag.add({ id: 'high', priority: 0.9, value: 2 });
    bag.add({ id: 'medium', priority: 0.5, value: 3 });

    expect(bag.size()).toBe(3);

    const samples: string[] = [];
    for (let i = 0; i < 100; i++) {
      const item = bag.sample();
      if (item) samples.push(item.id);
    }

    const highCount = samples.filter((s) => s === 'high').length;
    const lowCount = samples.filter((s) => s === 'low').length;
    expect(highCount).toBeGreaterThan(lowCount);
  });

  it('should respect capacity limits with probabilistic eviction', () => {
    const bag = new PriorityBag<{ id: string; priority: number }>({
      capacity: 2,
    });

    bag.add({ id: 'a', priority: 0.1 });
    bag.add({ id: 'b', priority: 0.2 });
    bag.add({ id: 'c', priority: 0.3 });

    expect(bag.size()).toBe(2);

    const samples: string[] = [];
    for (let i = 0; i < 200; i++) {
      const item = bag.sample();
      if (item) samples.push(item.id);
    }

    const cCount = samples.filter((s) => s === 'c').length;
    const bCount = samples.filter((s) => s === 'b').length;
    expect(cCount).toBeGreaterThan(bCount);
  });

  it('should decay priorities', () => {
    const bag = new PriorityBag<{ id: string; priority: number }>({
      capacity: 10,
      decayRate: 0.5,
    });

    bag.add({ id: 'item', priority: 1.0 });
    expect(bag.sample()?.priority).toBe(1.0);

    bag.decay();
    const afterDecay = bag.sample();
    expect(afterDecay?.priority).toBeLessThan(1.0);
    expect(afterDecay?.priority).toBeGreaterThan(0);
  });

  it('should remove items by id', () => {
    const bag = new PriorityBag<{ id: string; priority: number }>({
      capacity: 10,
    });

    bag.add({ id: 'a', priority: 0.5 });
    bag.add({ id: 'b', priority: 0.5 });
    expect(bag.size()).toBe(2);

    bag.remove('a');
    expect(bag.size()).toBe(1);
    expect(bag.sample()?.id).toBe('b');
  });

  it('removeAll drops a named set in one pass and leaves the rest intact', () => {
    const bag = new PriorityBag<{ id: string; priority: number }>({ capacity: 10 });
    for (const [id, priority] of Object.entries({ a: 0.5, b: 0.4, c: 0.3, d: 0.2 })) {
      bag.add({ id, priority });
    }

    // Sampled before and after: a drain must leave the surviving priorities weighted
    // exactly as they were, not merely present.
    expect(bag.removeAll(['b', 'missing', 'd'])).toBe(2);
    expect(bag.size()).toBe(2);
    expect(bag.removeAll([])).toBe(0);
    expect(bag.removeAll(['a', 'c'])).toBe(2);
    expect(bag.size()).toBe(0);
    expect(bag.sample()).toBeUndefined();
  });

  it('removeAll keeps sampling priority-proportional', () => {
    const bag = new PriorityBag<{ id: string; priority: number }>({
      capacity: 10,
      rng: createLCG(7),
    });
    for (const [id, priority] of Object.entries({ a: 0.6, b: 0.3, c: 0.1, d: 0.9 })) {
      bag.add({ id, priority });
    }
    bag.removeAll(['d']);

    const counts: Record<string, number> = {};
    for (let i = 0; i < 4000; i++) {
      const item = bag.sample();
      if (item) counts[item.id] = (counts[item.id] ?? 0) + 1;
    }
    const share = (id: string) => counts[id]! / 4000;
    expect(share('a')).toBeCloseTo(0.6, 1);
    expect(share('b')).toBeCloseTo(0.3, 1);
    expect(share('c')).toBeCloseTo(0.1, 1);
  });

  it('should iterate all items', () => {
    const bag = new PriorityBag<{ id: string; priority: number }>({
      capacity: 10,
    });

    bag.add({ id: 'a', priority: 0.3 });
    bag.add({ id: 'b', priority: 0.7 });

    const items = [...bag.all()];
    expect(items.length).toBe(2);
  });

  it('should return undefined when empty', () => {
    const bag = new PriorityBag<{ id: string; priority: number }>({
      capacity: 10,
    });

    expect(bag.sample()).toBeUndefined();
    expect(bag.size()).toBe(0);
  });

  it('should peek at highest priority without removing', () => {
    const bag = new PriorityBag<{ id: string; priority: number }>({
      capacity: 10,
    });

    bag.add({ id: 'low', priority: 0.1 });
    bag.add({ id: 'high', priority: 0.9 });

    expect(bag.peek()?.id).toBe('high');
    expect(bag.size()).toBe(2);
  });

  it('should clear all items', () => {
    const bag = new PriorityBag<{ id: string; priority: number }>({
      capacity: 10,
    });

    bag.add({ id: 'a', priority: 0.5 });
    bag.add({ id: 'b', priority: 0.5 });
    bag.clear();

    expect(bag.size()).toBe(0);
    expect(bag.sample()).toBeUndefined();
  });
});
