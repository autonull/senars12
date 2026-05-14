/**
 * Bag and BoundedBag Tests
 */

import {beforeEach, describe, expect, it} from '@jest/globals';
import {Bag} from '../../../src/nar';
import {BoundedBag} from '../../../src/nar';

describe('Bag', () => {
    let bag: Bag<string>;

    beforeEach(() => {
        bag = new Bag<string>(10);
    });

    it('should create Bag with max size', () => {
        expect(bag).toBeDefined();
        expect(bag.size).toBe(0);
    });

    it('should add items', () => {
        const added = bag.add('item1', 0.8);
        expect(added).toBe(true);
        expect(bag.size).toBe(1);
    });

    it('should maintain priority order', () => {
        bag.add('low', 0.3);
        bag.add('high', 0.9);
        bag.add('medium', 0.6);

        const items = bag.toArray();
        expect(items[0]).toBe('high');
        expect(items[1]).toBe('medium');
        expect(items[2]).toBe('low');
    });

    it('should replace lowest priority item when full', () => {
        for (let i = 0; i < 10; i++) {
            bag.add(`item${i}`, i * 0.1);
        }

        const added = bag.add('highPriority', 0.95);
        expect(added).toBe(true);
        expect(bag.size).toBe(10);
        expect(bag.toArray()[0]).toBe('highPriority');
    });

    it('should reject low priority items when full', () => {
        for (let i = 0; i < 10; i++) {
            bag.add(`item${i}`, 0.9 - i * 0.05);
        }

        const added = bag.add('lowPriority', 0.1);
        expect(added).toBe(false);
        expect(bag.size).toBe(10);
    });

    it('should return items', () => {
        bag.add('item1', 0.8);
        bag.add('item2', 0.6);

        const items = bag.getItems();
        expect(items).toHaveLength(2);
        expect(items).toContain('item1');
        expect(items).toContain('item2');
    });

    it('should iterate entries', () => {
        bag.add('item1', 0.8);
        bag.add('item2', 0.6);

        const entries = Array.from(bag.entries());
        expect(entries).toHaveLength(2);
        expect(entries[0][1]).toBeGreaterThanOrEqual(entries[1][1]);
    });

    it('should prune to size', () => {
        for (let i = 0; i < 10; i++) {
            bag.add(`item${i}`, i * 0.1);
        }

        bag.pruneTo(5);
        expect(bag.size).toBe(5);
    });

    it('should handle empty bag', () => {
        expect(bag.size).toBe(0);
        expect(bag.getItems()).toEqual([]);
        expect(Array.from(bag.entries())).toEqual([]);
    });

    it('should track addition time', () => {
        const before = Date.now();
        bag.add('item', 0.5);
        const after = Date.now();

        const items = bag.getItems();
        expect(items).toHaveLength(1);
    });
});

describe('BoundedBag', () => {
    let boundedBag: BoundedBag<string>;

    beforeEach(() => {
        boundedBag = new BoundedBag<string>(10);
    });

    it('should create BoundedBag with capacity', () => {
        expect(boundedBag).toBeDefined();
        expect(boundedBag.capacity).toBe(10);
        expect(boundedBag.size).toBe(0);
    });

    it('should add items', () => {
        const added = boundedBag.add('item1', 0.8);
        expect(added).toBe(true);
        expect(boundedBag.size).toBe(1);
    });

    it('should maintain capacity limit', () => {
        for (let i = 0; i < 15; i++) {
            boundedBag.add(`item${i}`, i * 0.1);
        }

        expect(boundedBag.size).toBeLessThanOrEqual(10);
    });

    describe('Overflow Behaviors', () => {
        it('should reject with reject behavior', () => {
            const bag = new BoundedBag<string>(5, {overflowBehavior: 'reject'});

            for (let i = 0; i < 5; i++) {
                bag.add(`item${i}`, 0.9);
            }

            const added = bag.add('new', 0.5);
            expect(added).toBe(false);
            expect(bag.size).toBe(5);
        });

        it('should replace lowest with replace-lowest behavior', () => {
            const bag = new BoundedBag<string>(5, {overflowBehavior: 'replace-lowest'});

            for (let i = 0; i < 5; i++) {
                bag.add(`item${i}`, i * 0.1);
            }

            const added = bag.add('highPriority', 0.95);
            expect(added).toBe(true);
            expect(bag.size).toBe(5);
        });

        it('should merge with merge behavior', () => {
            const bag = new BoundedBag<string>(5, {overflowBehavior: 'merge'});

            bag.add('item1', 0.5);
            bag.add('item1', 0.8);

            expect(bag.size).toBe(1);
        });
    });

    describe('Statistics', () => {
        it('should track statistics', () => {
            boundedBag.add('item1', 0.8);
            boundedBag.add('item2', 0.6);

            const stats = boundedBag.getStatistics();

            expect(stats.size).toBe(2);
            expect(stats.capacity).toBe(10);
            expect(stats.utilization).toBe(0.2);
        });

        it('should track priority distribution', () => {
            boundedBag.add('low', 0.3);
            boundedBag.add('high', 0.9);

            const stats = boundedBag.getStatistics();

            expect(stats.priorityDistribution.min).toBe(0.3);
            expect(stats.priorityDistribution.max).toBe(0.9);
        });

        it('should track throughput', () => {
            boundedBag.add('item1', 0.8);
            boundedBag.add('item2', 0.6);

            const stats = boundedBag.getStatistics();

            expect(stats.throughput.additions).toBeGreaterThanOrEqual(2);
        });
    });

    describe('Serialization', () => {
        it('should serialize state', () => {
            boundedBag.add('item1', 0.8);
            boundedBag.add('item2', 0.6);

            const state = boundedBag.serialize();

            expect(state.items).toHaveLength(2);
            expect(state.capacity).toBe(10);
        });

        it('should deserialize from state', () => {
            boundedBag.add('item1', 0.8);
            boundedBag.add('item2', 0.6);

            const state = boundedBag.serialize();
            const deserialized = BoundedBag.deserialize<string>(state);

            expect(deserialized.size).toBe(2);
            expect(deserialized.capacity).toBe(10);
        });
    });

    describe('Sampling', () => {
        it('should sample by priority', () => {
            boundedBag.add('low', 0.3);
            boundedBag.add('high', 0.9);

            const result = boundedBag.sample({type: 'priority', threshold: 0.5});

            expect(result).toBe('high');
        });

        it('should sample by recency', () => {
            boundedBag.add('old', 0.5);
            boundedBag.add('new', 0.5);

            const result = boundedBag.sample({type: 'recency', windowMs: 1000});

            expect(result).toBeDefined();
        });

        it('should sample by novelty', () => {
            boundedBag.add('item1', 0.5);
            boundedBag.add('item2', 0.5);

            const result = boundedBag.sample({type: 'novelty', maxDepth: 5});

            expect(result).toBeDefined();
        });

        it('should sample by composite score', () => {
            boundedBag.add('item1', 0.8);
            boundedBag.add('item2', 0.6);

            const result = boundedBag.sample({
                type: 'composite',
                weights: {priority: 0.7, recency: 0.2, novelty: 0.1}
            });

            expect(result).toBeDefined();
        });
    });

    describe('Consolidation', () => {
        it('should consolidate old items', () => {
            boundedBag.add('item1', 0.8);
            boundedBag.add('item2', 0.6);

            const currentTime = Date.now();
            boundedBag.consolidate(currentTime, 1000);

            expect(boundedBag.size).toBeLessThanOrEqual(2);
        });

        it('should remove items older than TTL', () => {
            boundedBag.add('old', 0.5);

            const currentTime = Date.now() + 2000;
            boundedBag.consolidate(currentTime, 1000);

            expect(boundedBag.size).toBe(0);
        });
    });

    describe('Clear', () => {
        it('should clear all items', () => {
            boundedBag.add('item1', 0.8);
            boundedBag.add('item2', 0.6);

            boundedBag.clear();

            expect(boundedBag.size).toBe(0);
            expect(boundedBag.getStatistics().throughput.additions).toBe(0);
        });
    });

    describe('Add Many', () => {
        it('should add multiple items', () => {
            const items: Array<[string, number]> = [
                ['item1', 0.8],
                ['item2', 0.6],
                ['item3', 0.9]
            ];

            const added = boundedBag.addMany(items);

            expect(added).toBe(3);
            expect(boundedBag.size).toBe(3);
        });
    });

    describe('Remove Many', () => {
        it('should remove items by predicate', () => {
            boundedBag.add('keep1', 0.8);
            boundedBag.add('remove1', 0.6);
            boundedBag.add('remove2', 0.7);

            const removed = boundedBag.removeMany(item => item.startsWith('remove'));

            expect(removed).toBe(2);
            expect(boundedBag.size).toBe(1);
        });
    });

    describe('Edge Cases', () => {
        it('should handle zero capacity', () => {
            const bag = new BoundedBag<string>(0);
            const added = bag.add('item', 0.9);
            expect(added).toBe(false);
        });

        it('should handle negative priority', () => {
            const added = boundedBag.add('item', -0.5);
            expect(added).toBe(true);
        });

        it('should handle priority > 1', () => {
            const added = boundedBag.add('item', 1.5);
            expect(added).toBe(true);
        });

        it('should maintain insertion order for equal priorities', () => {
            const bag = new BoundedBag<string>(5);
            bag.add('first', 0.5);
            bag.add('second', 0.5);
            bag.add('third', 0.5);

            const items = bag.toArray();
            expect(items).toHaveLength(3);
        });
    });
});

describe('Bag vs BoundedBag', () => {
    it('should have different behaviors', () => {
        const bag = new Bag<string>(5);
        const boundedBag = new BoundedBag<string>(5);

        for (let i = 0; i < 7; i++) {
            bag.add(`item${i}`, i * 0.1);
            boundedBag.add(`item${i}`, i * 0.1);
        }

        expect(bag.size).toBeLessThanOrEqual(5);
        expect(boundedBag.size).toBeLessThanOrEqual(5);
    });
});
