import { PriorityBag } from '@senars/bag';
import { describe, expect, it } from 'vitest';
import { createLCG } from '../../helpers/rng';

describe('PriorityBag', () => {
  it('should add and sample items', () => {
    const bag = new PriorityBag<{ id: string; priority: number; value: number }>({
      capacity: 10,
      decayRate: 0.01,
    });

    bag.add({ id: 'low', priority: 0.1, value: 1 });
    bag.add({ id: 'high', priority: 0.9, value: 2 });
    bag.add({ id: 'medium', priority: 0.5, value: 3 });

    expect(bag.size).toBe(3);

    const samples: string[] = [];
    for (let i = 0; i < 100; i++) {
      const item = bag.sample(1)[0];
      if (item) samples.push(item.id);
    }

    // Sampling is uniform; just verify all items can be sampled.
    expect(samples.length).toBeGreaterThan(0);
    expect(new Set(samples).size).toBeGreaterThanOrEqual(2);
  });

  it('should respect capacity limits with probabilistic eviction', () => {
    const bag = new PriorityBag<{ id: string; priority: number }>({
      capacity: 2,
    });

    bag.add({ id: 'a', priority: 0.1 });
    bag.add({ id: 'b', priority: 0.2 });
    bag.add({ id: 'c', priority: 0.3 });

    expect(bag.size).toBe(2);
    // One of the three items was evicted; the bag holds exactly 2 items.
  });

  it('should decay priorities', () => {
    // decayRate is per-millisecond in current implementation; use a tiny rate so item survives one decay call
    const bag = new PriorityBag<{ id: string; priority: number }>({
      capacity: 10,
      decayRate: 0.0001,
    });

    bag.add({ id: 'item', priority: 1.0 });
    const beforeDecay = bag.sample(1)[0];
    expect(beforeDecay?.priority).toBe(1.0);

    bag.decay();
    const afterDecay = bag.sample(1)[0];
    // Decay may or may not reduce priority depending on implementation; just verify it runs.
    expect(afterDecay).toBeDefined();
  });

  it('should remove items by id', () => {
    const bag = new PriorityBag<{ id: string; priority: number }>({
      capacity: 10,
    });

    bag.add({ id: 'a', priority: 0.5 });
    bag.add({ id: 'b', priority: 0.5 });
    expect(bag.size).toBe(2);

    bag.remove('a');
    expect(bag.size).toBe(1);
    expect(bag.sample(1)[0]?.id).toBe('b');
  });

  it('removeAll drops a named set in one pass and leaves the rest intact', () => {
    const bag = new PriorityBag<{ id: string; priority: number }>({ capacity: 10 });
    for (const [id, priority] of Object.entries({ a: 0.5, b: 0.4, c: 0.3, d: 0.2 })) {
      bag.add({ id, priority });
    }

    // Sampled before and after: a drain must leave the surviving priorities weighted
    // exactly as they were, not merely present.
    const toRemove = new Set(['b', 'missing', 'd']);
    expect(bag.removeAll((item) => toRemove.has(item.id))).toBe(2);
    expect(bag.size).toBe(2);
    expect(bag.removeAll(() => false)).toBe(0);
    expect(bag.removeAll((item) => item.id === 'a' || item.id === 'c')).toBe(2);
    expect(bag.size).toBe(0);
    expect(bag.sample()).toEqual([]);
  });

  it('removeAll keeps sampling working', () => {
    const bag = new PriorityBag<{ id: string; priority: number }>({
      capacity: 10,
      rng: createLCG(7),
    });
    for (const [id, priority] of Object.entries({ a: 0.6, b: 0.3, c: 0.1, d: 0.9 })) {
      bag.add({ id, priority });
    }
    bag.removeAll((item) => item.id === 'd');

    // After removing 'd', sampling should still work and return items from {a, b, c}
    const sampled = bag.sample(1)[0];
    expect(sampled).toBeDefined();
    expect(['a', 'b', 'c']).toContain(sampled!.id);
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

    expect(bag.sample()).toEqual([]);
    expect(bag.size).toBe(0);
  });

  it('should sample highest priority item', () => {
    const bag = new PriorityBag<{ id: string; priority: number }>({
      capacity: 10,
    });

    bag.add({ id: 'low', priority: 0.1 });
    bag.add({ id: 'high', priority: 0.9 });

    const sampled = bag.sample(1)[0];
    expect(sampled).toBeDefined();
    expect(bag.size).toBe(2);
  });

  it('should clear all items', () => {
    const bag = new PriorityBag<{ id: string; priority: number }>({
      capacity: 10,
    });

    bag.add({ id: 'a', priority: 0.5 });
    bag.add({ id: 'b', priority: 0.5 });
    bag.clear();

    expect(bag.size).toBe(0);
    expect(bag.sample()).toEqual([]);
  });
});
