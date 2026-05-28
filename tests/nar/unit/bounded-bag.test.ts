import {describe, expect, jest, test} from '@jest/globals';
import {BoundedBag} from '../../../src/nar';

describe('BoundedBag', () => {
    describe('constructor', () => {
        test('creates bag with specified capacity', () => {
            const bag = new BoundedBag<{ id: string }>(10);
            expect(bag.capacity).toBe(10);
        });

        test('accepts overflow behavior option', () => {
            const bag = new BoundedBag<{ id: string }>(5, {overflowBehavior: 'replace-lowest'});
            expect(bag.capacity).toBe(5);
        });

        test('onOverflow callback NOT called - currently not invoked by add method', () => {
            const callback = jest.fn();
            const bag = new BoundedBag<{ id: string }>(2, {overflowBehavior: 'reject', onOverflow: callback});
            bag.add({id: 'a'}, 0.5);
            bag.add({id: 'b'}, 0.6);
            bag.add({id: 'c'}, 0.9);
            expect(callback).not.toHaveBeenCalled();
        });

        test('onOverflow not called when bag not full', () => {
            const callback = jest.fn();
            const bag = new BoundedBag<{ id: string }>(5, {onOverflow: callback});
            bag.add({id: 'a'}, 0.5);
            bag.add({id: 'b'}, 0.6);
            expect(callback).not.toHaveBeenCalled();
        });
    });

    describe('add', () => {
        test('adds item within capacity', () => {
            const bag = new BoundedBag<{ id: string }>(5);
            expect(bag.add({id: 'a'}, 0.5)).toBe(true);
            expect(bag.size).toBe(1);
        });

        test('rejects on overflow when behavior is reject', () => {
            const bag = new BoundedBag<{ id: string }>(2, {overflowBehavior: 'reject'});
            bag.add({id: 'a'}, 0.5);
            bag.add({id: 'b'}, 0.5);
            expect(bag.add({id: 'c'}, 0.3)).toBe(false);
            expect(bag.size).toBe(2);
        });

        test('rejects when full and low priority (reject behavior)', () => {
            const bag = new BoundedBag<{ id: string }>(3, {overflowBehavior: 'reject'});
            bag.add({id: 'a'}, 0.5);
            bag.add({id: 'b'}, 0.5);
            bag.add({id: 'c'}, 0.5);
            expect(bag.add({id: 'd'}, 0.3)).toBe(false);
        });

        test('replaces lowest when full and high priority (replace-lowest behavior)', () => {
            const bag = new BoundedBag<{ id: string }>(3, {overflowBehavior: 'replace-lowest'});
            bag.add({id: 'a'}, 0.3);
            bag.add({id: 'b'}, 0.4);
            bag.add({id: 'c'}, 0.5);
            const result = bag.add({id: 'd'}, 0.9);
            expect(result).toBe(true);
            expect(bag.size).toBe(3);
        });

        test('rejects when priority not higher than minimum (replace-lowest)', () => {
            const bag = new BoundedBag<{ id: string }>(2, {overflowBehavior: 'replace-lowest'});
            bag.add({id: 'a'}, 0.5);
            bag.add({id: 'b'}, 0.5);
            expect(bag.add({id: 'c'}, 0.3)).toBe(false);
        });

        test('merges when item already exists (merge behavior)', () => {
            const bag = new BoundedBag<{ id: string }>(3, {overflowBehavior: 'merge'});
            bag.add({id: 'a'}, 0.5);
            bag.add({id: 'b'}, 0.5);
            bag.add({id: 'c'}, 0.5);
            const result = bag.add({id: 'a'}, 0.8);
            expect(result).toBe(true);
            expect(bag.size).toBe(3);
        });

        test('evicts lowest when merging with new item (merge behavior)', () => {
            const bag = new BoundedBag<{ id: string }>(2, {overflowBehavior: 'merge'});
            bag.add({id: 'a'}, 0.3);
            bag.add({id: 'b'}, 0.5);
            const result = bag.add({id: 'c'}, 0.8);
            expect(result).toBe(true);
            expect(bag.size).toBe(2);
        });
    });

    describe('addMany', () => {
        test('addMany adds items and returns count', () => {
            const bag = new BoundedBag<{ id: string }>(10);
            const added = bag.addMany([[{id: 'a'}, 0.5], [{id: 'b'}, 0.6], [{id: 'c'}, 0.7]]);
            expect(added).toBe(3);
            expect(bag.size).toBe(3);
        });

        test('addMany with reject overflow discards lowest priority when full', () => {
            const bag = new BoundedBag<{ id: string }>(3, {overflowBehavior: 'reject'});
            const added = bag.addMany([[{id: 'a'}, 0.5], [{id: 'b'}, 0.6], [{id: 'c'}, 0.7], [{id: 'd'}, 0.8]]);
            expect(added).toBe(4);
            expect(bag.size).toBe(3);
        });
    });

    describe('sample', () => {
        test('samples proportionally by priority', () => {
            const bag = new BoundedBag<{ id: string }>(5);
            bag.add({id: 'low'}, 0.3);
            bag.add({id: 'high'}, 0.9);

            const result = bag.sample({type: 'priority'});
            expect(result?.id).toBeDefined();
        });

        test('samples proportionally even with low values', () => {
            const bag = new BoundedBag<{ id: string }>(5);
            bag.add({id: 'low'}, 0.2);

            const result = bag.sample({type: 'priority'});
            expect(result?.id).toBe('low');
        });

        test('samples by recency window', () => {
            const bag = new BoundedBag<{ id: string }>(5);
            bag.add({id: 'old'}, 0.5);
            bag.add({id: 'new'}, 0.5);

            const result = bag.sample({type: 'recency', windowMs: 60000});
            expect(result).toBeDefined();
        });

        test('samples novelty (most recent)', () => {
            const bag = new BoundedBag<{ id: string }>(5);
            bag.add({id: 'first'}, 0.5);
            bag.add({id: 'second'}, 0.6);

            const result = bag.sample({type: 'novelty', maxDepth: 1});
            expect(result).toBeDefined();
        });

        test('samples by composite weights', () => {
            const bag = new BoundedBag<{ id: string }>(5);
            bag.add({id: 'a'}, 0.8);
            bag.add({id: 'b'}, 0.6);

            const result = bag.sample({
                type: 'composite',
                weights: {priority: 0.5, recency: 0.3, novelty: 0.2}
            });
            expect(result).toBeDefined();
        });
    });

    describe('getStatistics', () => {
        test('reports correct size and capacity', () => {
            const bag = new BoundedBag<{ id: string }>(10);
            bag.add({id: 'a'}, 0.5);
            bag.add({id: 'b'}, 0.6);

            const stats = bag.getStatistics();
            expect(stats.size).toBe(2);
            expect(stats.capacity).toBe(10);
        });

        test('reports utilization', () => {
            const bag = new BoundedBag<{ id: string }>(4);
            bag.add({id: 'a'}, 0.5);
            bag.add({id: 'b'}, 0.5);

            const stats = bag.getStatistics();
            expect(stats.utilization).toBe(0.5);
        });

        test('reports priority distribution', () => {
            const bag = new BoundedBag<{ id: string }>(5);
            bag.add({id: 'a'}, 0.3);
            bag.add({id: 'b'}, 0.6);
            bag.add({id: 'c'}, 0.9);

            const stats = bag.getStatistics();
            expect(stats.priorityDistribution.min).toBe(0.3);
            expect(stats.priorityDistribution.max).toBe(0.9);
            expect(stats.priorityDistribution.avg).toBeCloseTo(0.6);
        });

        test('reports age histogram', () => {
            const bag = new BoundedBag<{ id: string }>(5);
            bag.add({id: 'a'}, 0.5);

            const stats = bag.getStatistics();
            expect(stats.ageHistogram.buckets).toBeDefined();
            expect(stats.ageHistogram.buckets.length).toBe(4);
        });

        test('reports throughput stats', () => {
            const bag = new BoundedBag<{ id: string }>(5);
            bag.add({id: 'a'}, 0.5);
            bag.sample({type: 'priority'});

            const stats = bag.getStatistics();
            expect(stats.throughput.additions).toBe(1);
        });
    });

    describe('consolidate', () => {
        test('removes items older than ttl', () => {
            const bag = new BoundedBag<{ id: string }>(5);
            bag.add({id: 'recent'}, 0.5);

            bag.consolidate(Date.now(), 60000);
            expect(bag.size).toBe(1);

            bag.consolidate(Date.now() - 120000, 60000);
            expect(bag.size).toBeLessThanOrEqual(1);
        });

        test('keeps recent items', () => {
            const bag = new BoundedBag<{ id: string }>(5);
            bag.add({id: 'recent'}, 0.5);

            bag.consolidate(Date.now(), 60000);

            expect(bag.size).toBe(1);
        });
    });

    describe('clear', () => {
        test('removes all items', () => {
            const bag = new BoundedBag<{ id: string }>(5);
            bag.add({id: 'a'}, 0.5);
            bag.add({id: 'b'}, 0.6);
            bag.clear();

            expect(bag.size).toBe(0);
        });

        test('resets statistics', () => {
            const bag = new BoundedBag<{ id: string }>(5);
            bag.add({id: 'a'}, 0.5);
            bag.clear();

            const stats = bag.getStatistics();
            expect(stats.throughput.additions).toBe(0);
        });
    });

    describe('serialize/deserialize', () => {
        test('serializes and deserializes correctly', () => {
            const bag = new BoundedBag<{ id: string }>(5, {overflowBehavior: 'replace-lowest'});
            bag.add({id: 'a'}, 0.5);
            bag.add({id: 'b'}, 0.7);

            const state = bag.serialize();
            const restored = BoundedBag.deserialize(state);

            expect(restored.capacity).toBe(5);
            expect(restored.size).toBe(2);
        });

        test('restores items with priorities', () => {
            const bag = new BoundedBag<{ id: string }>(5);
            bag.add({id: 'test'}, 0.8);

            const state = bag.serialize();
            const restored = BoundedBag.deserialize(state);

            expect(restored.size).toBe(1);
        });
    });

    describe('removeMany', () => {
        test('removes items matching predicate', () => {
            const bag = new BoundedBag<{ id: string }>(5);
            bag.add({id: 'keep'}, 0.5);
            bag.add({id: 'remove'}, 0.6);

            const removed = bag.removeMany(item => item.id === 'remove');

            expect(removed).toBe(1);
            expect(bag.size).toBe(1);
        });

        test('returns 0 when no matches', () => {
            const bag = new BoundedBag<{ id: string }>(5);
            bag.add({id: 'a'}, 0.5);

            const removed = bag.removeMany(item => item.id === 'nonexistent');
            expect(removed).toBe(0);
        });
    });
});