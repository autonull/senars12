import {LinkBag} from '../../../../src/nar/memory/links';
import type {LinkEntry} from '../../../../src/nar/memory/links';

describe('LinkBag', () => {
    describe('capacity eviction', () => {
        it('should evict lowest priority when at capacity', () => {
            const bag = new LinkBag(3, 'priority');

            const entry1: LinkEntry = {
                id: '1_2_term-link',
                sourceHash: 1,
                targetHash: 2,
                type: 'term-link',
                priority: 0.9,
                createdAt: Date.now(),
                lastAccessedAt: Date.now(),
            };

            const entry2: LinkEntry = {
                id: '2_3_term-link',
                sourceHash: 2,
                targetHash: 3,
                type: 'term-link',
                priority: 0.5,
                createdAt: Date.now(),
                lastAccessedAt: Date.now(),
            };

            const entry3: LinkEntry = {
                id: '3_4_term-link',
                sourceHash: 3,
                targetHash: 4,
                type: 'term-link',
                priority: 0.7,
                createdAt: Date.now(),
                lastAccessedAt: Date.now(),
            };

            expect(bag.add(entry1)).toBe(true);
            expect(bag.add(entry2)).toBe(true);
            expect(bag.add(entry3)).toBe(true);
            expect(bag.size()).toBe(3);

            const entry4: LinkEntry = {
                id: '4_5_term-link',
                sourceHash: 4,
                targetHash: 5,
                type: 'term-link',
                priority: 0.8,
                createdAt: Date.now(),
                lastAccessedAt: Date.now(),
            };

            expect(bag.add(entry4)).toBe(true);
            expect(bag.size()).toBe(3);

            expect(bag.get('2_3_term-link')).toBeUndefined();
        });
    });

    describe('forget policies', () => {
        it('should evict by priority with priority policy', () => {
            const bag = new LinkBag(2, 'priority');

            const entry1: LinkEntry = {
                id: '1_2_term-link',
                sourceHash: 1,
                targetHash: 2,
                type: 'term-link',
                priority: 0.9,
                createdAt: Date.now(),
                lastAccessedAt: Date.now(),
            };

            const entry2: LinkEntry = {
                id: '2_3_term-link',
                sourceHash: 2,
                targetHash: 3,
                type: 'term-link',
                priority: 0.3,
                createdAt: Date.now(),
                lastAccessedAt: Date.now(),
            };

            bag.add(entry1);
            bag.add(entry2);

            const lowest = bag.peekLowest();
            expect(lowest?.id).toBe('2_3_term-link');
        });
    });

    describe('decay', () => {
        it('should decay priorities and remove sub-threshold', () => {
            const bag = new LinkBag(10, 'priority');

            const entry: LinkEntry = {
                id: '1_2_term-link',
                sourceHash: 1,
                targetHash: 2,
                type: 'term-link',
                priority: 0.015,
                createdAt: Date.now(),
                lastAccessedAt: Date.now(),
            };

            bag.add(entry);
            bag.applyDecay(0.5);

            expect(bag.size()).toBe(0);
        });
    });
});
