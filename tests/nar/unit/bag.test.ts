/**
 * Bag Tests - Consolidated and DRY
 * 
 * Tests for Bag class with improved coverage and DRY patterns
 */

import {Bag} from '../../../src/nar';

type TestItem = {id: string; value?: number};

describe('Bag', () => {
  describe('add', () => {
    test.each`
      capacity | priority | expected
      ${3} | ${0.5} | ${true}
      ${5} | ${0.9} | ${true}
      ${1} | ${0.2} | ${true}
    `('adds item with priority $priority to bag of capacity $capacity', ({capacity, priority, expected}) => {
      const bag = new Bag<TestItem>(capacity);
      expect(bag.add({id: 'test'}, priority)).toBe(expected);
    });

    test('rejects when full and low priority', () => {
      const bag = new Bag<TestItem>(3);
      bag.add({id: 'a'}, 0.5);
      bag.add({id: 'b'}, 0.5);
      bag.add({id: 'c'}, 0.5);
      
      expect(bag.add({id: 'd'}, 0.3)).toBe(false);
      expect(bag.size).toBe(3);
    });

    test('evicts lowest priority when full and high priority added', () => {
      const bag = new Bag<TestItem>(3);
      bag.add({id: 'a'}, 0.3);
      bag.add({id: 'b'}, 0.3);
      bag.add({id: 'c'}, 0.3);
      
      expect(bag.add({id: 'd'}, 0.9)).toBe(true);
      expect(bag.size).toBe(3);
      expect(bag.peek()?.id).toBe('d');
    });

    test('maintains priority order', () => {
      const bag = new Bag<TestItem>(3);
      bag.add({id: 'low'}, 0.2);
      bag.add({id: 'high'}, 0.9);
      bag.add({id: 'med'}, 0.5);
      
      expect(bag.peek()?.id).toBe('high');
    });
  });

  describe('remove', () => {
    test('removes existing item', () => {
      const bag = new Bag<TestItem>(3);
      const item = {id: 'a'};
      bag.add(item, 0.5);
      
      expect(bag.remove(item)).toBe(true);
      expect(bag.size).toBe(0);
    });

    test('returns false for missing item', () => {
      const bag = new Bag<TestItem>(3);
      expect(bag.remove({id: 'x'})).toBe(false);
    });

    test('returns false when empty', () => {
      const bag = new Bag<TestItem>(3);
      expect(bag.remove({id: 'x'})).toBe(false);
    });
  });

  describe('peek', () => {
    test('returns highest priority item', () => {
      const bag = new Bag<TestItem>(3);
      bag.add({id: 'low'}, 0.3);
      bag.add({id: 'high'}, 0.9);
      expect(bag.peek()?.id).toBe('high');
    });

    test('returns undefined when empty', () => {
      const bag = new Bag<TestItem>(3);
      expect(bag.peek()).toBeUndefined();
    });
  });

  describe('pruneTo', () => {
    test.each`
      initialSize | pruneTo | expectedSize
      ${5} | ${3} | ${3}
      ${3} | ${1} | ${1}
      ${10} | ${5} | ${5}
      ${3} | ${10} | ${3}
    `('truncates from $initialSize to $expectedSize', ({initialSize, pruneTo, expectedSize}) => {
      const bag = new Bag<TestItem>(10);
      for (let i = 0; i < initialSize; i++) {
        bag.add({id: `item${i}`}, 0.5);
      }
      
      bag.pruneTo(pruneTo);
      expect(bag.size).toBe(expectedSize);
    });

    test('removes lowest priority items first', () => {
      const bag = new Bag<TestItem>(3);
      bag.add({id: 'low1'}, 0.1);
      bag.add({id: 'low2'}, 0.2);
      bag.add({id: 'high'}, 0.9);
      
      bag.pruneTo(1);
      
      expect(bag.peek()?.id).toBe('high');
    });
  });

  describe('entries and iteration', () => {
    test('yields items with priorities in order', () => {
      const bag = new Bag<TestItem>(3);
      bag.add({id: 'a'}, 0.5);
      bag.add({id: 'b'}, 0.3);
      bag.add({id: 'c'}, 0.8);
      
      const entries = [...bag.entries()];
      
      expect(entries).toHaveLength(3);
      expect(entries.map((e) => e[1])).toEqual([0.8, 0.5, 0.3]);
    });

    test('returns empty array for empty bag', () => {
      const bag = new Bag<TestItem>(3);
      expect([...bag.entries()]).toHaveLength(0);
    });
  });

  describe('toArray and getItems', () => {
    test('returns items in priority order', () => {
      const bag = new Bag<TestItem>(3);
      bag.add({id: 'low'}, 0.3);
      bag.add({id: 'high'}, 0.9);
      bag.add({id: 'med'}, 0.6);
      
      expect(bag.toArray().map((i) => i.id)).toEqual(['high', 'med', 'low']);
    });

    test('returns copy of items', () => {
      const bag = new Bag<TestItem>(3);
      bag.add({id: 'test'}, 0.5);
      const items = bag.toArray();
      
      bag.add({id: 'another'}, 0.6);
      expect(items).toHaveLength(1);
    });

    test('getItems returns all items', () => {
      const bag = new Bag<TestItem>(3);
      bag.add({id: 'a'}, 0.5);
      bag.add({id: 'b'}, 0.6);
      
      const items = bag.getItems();
      expect(items).toHaveLength(2);
      expect(items).toContainEqual({id: 'a'});
      expect(items).toContainEqual({id: 'b'});
    });
  });

  describe('edge cases', () => {
    test('handles zero capacity', () => {
      const bag = new Bag<TestItem>(0);
      expect(bag.add({id: 'test'}, 0.9)).toBe(false);
      expect(bag.size).toBe(0);
    });

    test('handles equal priorities', () => {
      const bag = new Bag<TestItem>(3);
      bag.add({id: 'a'}, 0.5);
      bag.add({id: 'b'}, 0.5);
      bag.add({id: 'c'}, 0.5);
      
      expect(bag.size).toBe(3);
    });

    test('handles negative priorities', () => {
      const bag = new Bag<TestItem>(3);
      expect(bag.add({id: 'neg'}, -0.5)).toBe(true);
      expect(bag.size).toBe(1);
    });

    test('handles priorities greater than 1', () => {
      const bag = new Bag<TestItem>(3);
      expect(bag.add({id: 'high'}, 1.5)).toBe(true);
      expect(bag.add({id: 'higher'}, 10.0)).toBe(true);
      expect(bag.size).toBe(2);
    });

    test('handles very large capacity', () => {
      const bag = new Bag<TestItem>(10000);
      for (let i = 0; i < 100; i++) {
        bag.add({id: `item${i}`}, 0.5);
      }
      expect(bag.size).toBe(100);
    });
  });

  describe('performance', () => {
    test('maintains performance with many items', () => {
      const bag = new Bag<TestItem>(1000);
      const start = Date.now();
      
      for (let i = 0; i < 1000; i++) {
        bag.add({id: `item${i}`}, Math.random());
      }
      
      const duration = Date.now() - start;
      expect(duration).toBeLessThan(1000);
      expect(bag.size).toBeLessThanOrEqual(1000);
    });
  });
});
