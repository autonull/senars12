import {Bag} from '../../../src/nar';

type BagItem = {id: string};

describe('Bag', () => {
  let bag: Bag<BagItem>;

  beforeEach(() => {
    bag = new Bag<BagItem>(3);
  });

  describe('add', () => {
    test.each([
      {capacity: 3, priority: 0.5, expected: true},
      {capacity: 5, priority: 0.9, expected: true},
      {capacity: 1, priority: 0.2, expected: true},
    ])('adds item with priority $priority to bag of capacity $capacity', ({
      capacity,
      priority,
      expected,
    }) => {
      const testBag = new Bag<BagItem>(capacity);
      expect(testBag.add({id: 'test'}, priority)).toBe(expected);
    });

    test('rejects when full and low priority', () => {
      bag.add({id: 'a'}, 0.5);
      bag.add({id: 'b'}, 0.5);
      bag.add({id: 'c'}, 0.5);
      
      expect(bag.add({id: 'd'}, 0.3)).toBe(false);
      expect(bag.size).toBe(3);
    });

    test('evicts lowest priority when full and high priority added', () => {
      bag.add({id: 'a'}, 0.3);
      bag.add({id: 'b'}, 0.3);
      bag.add({id: 'c'}, 0.3);
      const added = bag.add({id: 'd'}, 0.9);
      
      expect(added).toBe(true);
      expect(bag.size).toBe(3);
      expect(bag.peek()?.id).toBe('d');
    });

    test('maintains priority order', () => {
      bag.add({id: 'low'}, 0.2);
      bag.add({id: 'high'}, 0.9);
      bag.add({id: 'med'}, 0.5);
      
      expect(bag.peek()?.id).toBe('high');
    });
  });

  describe('remove', () => {
    test('removes existing item', () => {
      const item = {id: 'a'};
      bag.add(item, 0.5);
      
      expect(bag.remove(item)).toBe(true);
      expect(bag.size).toBe(0);
    });

    test('returns false for missing item', () => {
      expect(bag.remove({id: 'x'})).toBe(false);
    });

    test('returns false when bag is empty', () => {
      expect(bag.remove({id: 'x'})).toBe(false);
    });
  });

  describe('peek', () => {
    test('returns highest priority item', () => {
      bag.add({id: 'low'}, 0.3);
      bag.add({id: 'high'}, 0.9);
      expect(bag.peek()?.id).toBe('high');
    });

    test('returns undefined when empty', () => {
      expect(bag.peek()).toBeUndefined();
    });
  });

  describe('pruneTo', () => {
    test.each([
      {initialSize: 5, pruneTo: 3, expectedSize: 3},
      {initialSize: 3, pruneTo: 1, expectedSize: 1},
      {initialSize: 10, pruneTo: 5, expectedSize: 5},
      {initialSize: 3, pruneTo: 10, expectedSize: 3},
    ])('truncates from $initialSize to $expectedSize', ({
      initialSize,
      pruneTo,
      expectedSize,
    }) => {
      const testBag = new Bag<BagItem>(10);
      for (let i = 0; i < initialSize; i++) {
        testBag.add({id: 'item' + i}, 0.5);
      }
      
      testBag.pruneTo(pruneTo);
      expect(testBag.size).toBe(expectedSize);
    });

    test('removes lowest priority items first', () => {
      bag.add({id: 'low1'}, 0.1);
      bag.add({id: 'low2'}, 0.2);
      bag.add({id: 'high'}, 0.9);
      
      bag.pruneTo(1);
      
      expect(bag.peek()?.id).toBe('high');
    });
  });

  describe('entries', () => {
    test('yields items with priorities in order', () => {
      bag.add({id: 'a'}, 0.5);
      bag.add({id: 'b'}, 0.3);
      bag.add({id: 'c'}, 0.8);
      
      const entries = [...bag.entries()];
      
      expect(entries).toHaveLength(3);
      expect(entries.map((e) => e[1])).toEqual([0.8, 0.5, 0.3]);
    });

    test('returns empty array for empty bag', () => {
      const entries = [...bag.entries()];
      expect(entries).toHaveLength(0);
    });
  });

  describe('toArray', () => {
    test('returns items in priority order', () => {
      bag.add({id: 'low'}, 0.3);
      bag.add({id: 'high'}, 0.9);
      bag.add({id: 'med'}, 0.6);
      
      const items = bag.toArray();
      
      expect(items.map((i) => i.id)).toEqual(['high', 'med', 'low']);
    });

    test('returns copy of items', () => {
      bag.add({id: 'test'}, 0.5);
      const items = bag.toArray();
      
      bag.add({id: 'another'}, 0.6);
      expect(items).toHaveLength(1);
    });
  });

  describe('getItems', () => {
    test('returns all items', () => {
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
      const zeroBag = new Bag<BagItem>(0);
      expect(zeroBag.add({id: 'test'}, 0.9)).toBe(false);
      expect(zeroBag.size).toBe(0);
    });

    test('handles equal priorities', () => {
      bag.add({id: 'a'}, 0.5);
      bag.add({id: 'b'}, 0.5);
      bag.add({id: 'c'}, 0.5);
      
      expect(bag.size).toBe(3);
    });

    test('handles negative priorities', () => {
      expect(bag.add({id: 'neg'}, -0.5)).toBe(true);
      expect(bag.size).toBe(1);
    });

    test('handles priorities greater than 1', () => {
      expect(bag.add({id: 'high'}, 1.5)).toBe(true);
      expect(bag.add({id: 'higher'}, 10.0)).toBe(true);
      expect(bag.size).toBe(2);
    });
  });
});
