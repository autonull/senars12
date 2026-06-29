/**
 * Bag Tests - Consolidated and DRY
 *
 * Tests for Bag class with improved coverage and DRY patterns
 */

import {Bag} from '../../../nar/src';

type TestItem = { id: string; value?: number };

const TEST_ITEMS = [{id: 'a'}, {id: 'b'}, {id: 'c'}, {id: 'd'}, {id: 'e'}] as const;

describe('Bag', () => {
    describe('add', () => {
        test.each`
      capacity | priority | expected
      ${3}     | ${0.5}   | ${true}
      ${5}     | ${0.9}   | ${true}
      ${1}     | ${0.2}   | ${true}
    `(
            'adds item with priority $priority to bag of capacity $capacity',
            ({capacity, priority, expected}) => {
                const bag = new Bag<TestItem>(capacity);
                expect(bag.add({id: 'test'}, priority)).toBe(expected);
            }
        );

        test.each`
      capacity | priorities         | newPriority | expected | description
      ${3}     | ${[0.5, 0.5, 0.5]} | ${0.3}      | ${false} | ${'rejects when full and low priority'}
      ${3}     | ${[0.3, 0.3, 0.3]} | ${0.9}      | ${true}  | ${'evicts when full and high priority'}
    `('$description', ({capacity, priorities, newPriority, expected}) => {
            const bag = new Bag<TestItem>(capacity);
            priorities.forEach((p: number) => bag.add({id: 'item'}, p));

            expect(bag.add({id: 'new'}, newPriority)).toBe(expected);
            expect(bag.size).toBe(capacity);
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

        test.each`
      description                         | setup | itemId | expected
      ${'returns false for missing item'} | ${''} | ${'x'} | ${false}
      ${'returns false when empty'}       | ${''} | ${'x'} | ${false}
    `('$description', ({setup, itemId, expected}) => {
            const bag = new Bag<TestItem>(3);
            expect(bag.remove({id: itemId as string})).toBe(expected);
        });
    });

    describe('peek', () => {
        test.each`
      items                                              | expected
      ${[]}                                              | ${undefined}
      ${[{id: 'low', p: 0.3}, {id: 'high', p: 0.9}]} | ${'high'}
    `('returns $expected when bag has items', ({items, expected}) => {
            const bag = new Bag<TestItem>(3);
            items.forEach(({id, p}: any) => bag.add({id}, p));
            expect(bag.peek()?.id).toBe(expected);
        });
    });

    describe('pruneTo', () => {
        test.each`
      initialSize | pruneTo | expectedSize
      ${5}        | ${3}    | ${3}
      ${3}        | ${1}    | ${1}
      ${10}       | ${5}    | ${5}
      ${3}        | ${10}   | ${3}
    `('truncates from $initialSize to $expectedSize', ({initialSize, pruneTo, expectedSize}) => {
            const bag = new Bag<TestItem>(10);
            for (let i = 0; i < initialSize; i++) {
                bag.add({id: `item${i}`}, 0.5);
            }

            bag.pruneTo(pruneTo);
            expect(bag.size).toBe(expectedSize);
        });

        test.each`
      items                                                                       | keepCount | expectedId
      ${[{id: 'low1', p: 0.1}, {id: 'low2', p: 0.2}, {id: 'high', p: 0.9}]} | ${1}      | ${'high'}
      ${[{id: 'a', p: 0.5}, {id: 'b', p: 0.6}, {id: 'c', p: 0.7}]}          | ${2}      | ${'c'}
    `('keeps highest priority items when pruning', ({items, keepCount, expectedId}) => {
            const bag = new Bag<TestItem>(3);
            items.forEach(({id, p}: any) => bag.add({id}, p));

            bag.pruneTo(keepCount);
            expect(bag.peek()?.id).toBe(expectedId);
        });
    });

    describe('entries and iteration', () => {
        test.each`
      items                                                              | expectedPriorities
      ${[]}                                                              | ${[]}
      ${[{id: 'a', p: 0.5}, {id: 'b', p: 0.3}, {id: 'c', p: 0.8}]} | ${[0.8, 0.5, 0.3]}
    `('yields items with priorities in order', ({items, expectedPriorities}) => {
            const bag = new Bag<TestItem>(3);
            items.forEach(({id, p}: any) => bag.add({id}, p));

            const entries = [...bag.entries()];
            expect(entries.map((e) => e[1])).toEqual(expectedPriorities);
        });
    });

    describe('toArray and getItems', () => {
        test.each`
      items                                                                     | expectedOrder
      ${[{id: 'low', p: 0.3}, {id: 'high', p: 0.9}, {id: 'med', p: 0.6}]} | ${['high', 'med', 'low']}
    `('returns items in priority order', ({items, expectedOrder}) => {
            const bag = new Bag<TestItem>(3);
            items.forEach(({id, p}: any) => bag.add({id}, p));

            expect(bag.toArray().map((i) => i.id)).toEqual(expectedOrder);
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

        test.each`
      priority | description
      ${-0.5}  | ${'handles negative priorities'}
      ${1.5}   | ${'handles priorities greater than 1'}
    `('$description', ({priority}) => {
            const bag = new Bag<TestItem>(3);
            expect(bag.add({id: 'test'}, priority)).toBe(true);
        });

        test('handles equal priorities', () => {
            const bag = new Bag<TestItem>(3);
            bag.add({id: 'a'}, 0.5);
            bag.add({id: 'b'}, 0.5);
            bag.add({id: 'c'}, 0.5);

            expect(bag.size).toBe(3);
        });

        test('handles very large capacity', () => {
            const bag = new Bag<TestItem>(10000);
            for (let i = 0; i < 100; i++) {
                bag.add({id: `item${i}`}, 0.5);
            }
            expect(bag.size).toBe(100);
        });

        test('handles priorities greater than 1', () => {
            const bag = new Bag<TestItem>(3);
            expect(bag.add({id: 'high'}, 1.5)).toBe(true);
            expect(bag.add({id: 'higher'}, 10.0)).toBe(true);
            expect(bag.size).toBe(2);
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
