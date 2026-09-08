import {describe, it, expect} from 'vitest';
import {PriorityBag} from '@senars/nar/bag';

describe('PriorityBag', () => {
  it('should add and sample items by priority', () => {
    const bag = new PriorityBag<{id: string; priority: number; value: number}>({
      capacity: 10,
      decayRate: 0.01,
    });

    bag.add({id: 'low', priority: 0.1, value: 1});
    bag.add({id: 'high', priority: 0.9, value: 2});
    bag.add({id: 'medium', priority: 0.5, value: 3});

    expect(bag.size()).toBe(3);

    const samples: string[] = [];
    for (let i = 0; i < 100; i++) {
      const item = bag.sample();
      if (item) samples.push(item.id);
    }

    const highCount = samples.filter(s => s === 'high').length;
    const lowCount = samples.filter(s => s === 'low').length;
    expect(highCount).toBeGreaterThan(lowCount);
  });

  it('should respect capacity limits with probabilistic eviction', () => {
    const bag = new PriorityBag<{id: string; priority: number}>({
      capacity: 2,
    });

    bag.add({id: 'a', priority: 0.1});
    bag.add({id: 'b', priority: 0.2});
    bag.add({id: 'c', priority: 0.3});

    expect(bag.size()).toBe(2);

    const samples: string[] = [];
    for (let i = 0; i < 200; i++) {
      const item = bag.sample();
      if (item) samples.push(item.id);
    }

    const cCount = samples.filter(s => s === 'c').length;
    const bCount = samples.filter(s => s === 'b').length;
    expect(cCount).toBeGreaterThan(bCount);
  });

  it('should decay priorities', () => {
    const bag = new PriorityBag<{id: string; priority: number}>({
      capacity: 10,
      decayRate: 0.5,
    });

    bag.add({id: 'item', priority: 1.0});
    expect(bag.sample()?.priority).toBe(1.0);

    bag.decay();
    const afterDecay = bag.sample();
    expect(afterDecay?.priority).toBeLessThan(1.0);
    expect(afterDecay?.priority).toBeGreaterThan(0);
  });

  it('should remove items by id', () => {
    const bag = new PriorityBag<{id: string; priority: number}>({
      capacity: 10,
    });

    bag.add({id: 'a', priority: 0.5});
    bag.add({id: 'b', priority: 0.5});
    expect(bag.size()).toBe(2);

    bag.remove('a');
    expect(bag.size()).toBe(1);
    expect(bag.sample()?.id).toBe('b');
  });

  it('should iterate all items', () => {
    const bag = new PriorityBag<{id: string; priority: number}>({
      capacity: 10,
    });

    bag.add({id: 'a', priority: 0.3});
    bag.add({id: 'b', priority: 0.7});

    const items = [...bag.all()];
    expect(items.length).toBe(2);
  });

  it('should return undefined when empty', () => {
    const bag = new PriorityBag<{id: string; priority: number}>({
      capacity: 10,
    });

    expect(bag.sample()).toBeUndefined();
    expect(bag.size()).toBe(0);
  });

  it('should peek at highest priority without removing', () => {
    const bag = new PriorityBag<{id: string; priority: number}>({
      capacity: 10,
    });

    bag.add({id: 'low', priority: 0.1});
    bag.add({id: 'high', priority: 0.9});

    expect(bag.peek()?.id).toBe('high');
    expect(bag.size()).toBe(2);
  });

  it('should clear all items', () => {
    const bag = new PriorityBag<{id: string; priority: number}>({
      capacity: 10,
    });

    bag.add({id: 'a', priority: 0.5});
    bag.add({id: 'b', priority: 0.5});
    bag.clear();

    expect(bag.size()).toBe(0);
    expect(bag.sample()).toBeUndefined();
  });
});