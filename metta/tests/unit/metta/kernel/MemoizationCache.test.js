import {MemoizationCache} from '@senars/metta/src/kernel/MemoizationCache.js';

describe('MemoizationCache', () => {
    // Mock Term objects (just plain objects for testing)
    const t1 = {id: 1};
    const t2 = {id: 2};
    const t3 = {id: 3};
    // const t4 = { id: 4 };

    test('Basic Set/Get', () => {
        const cache = new MemoizationCache(10);
        cache.set(t1, 'val1');
        expect(cache.get(t1)).toBe('val1');
        expect(cache.get(t2)).toBeUndefined();
    });

    test('Capacity Eviction (LRU)', () => {
        const cache = new MemoizationCache(2); // Capacity 2

        cache.set(t1, 'a');
        cache.set(t2, 'b');
        // Cache: [t2=b, t1=a] (MRU is likely just set, but "linked list" implementation specific)
        // Usually LRU cache adds to head.
        // Let's assume implementation details:
        // set(t1) -> t1 is head
        // set(t2) -> t2 is head, t1 is tail

        // Access t1, making it MRU
        expect(cache.get(t1)).toBe('a');
        // Cache: [t1=a, t2=b] (t1 moved to head)

        cache.set(t3, 'c');
        // Cache full, should evict LRU (t2 - the tail)
        // Cache: [t3=c, t1=a]

        expect(cache.get(t3)).toBe('c');
        expect(cache.get(t1)).toBe('a');
        expect(cache.get(t2)).toBeUndefined();

        const stats = cache.getStats();
        expect(stats.size).toBe(2);
        expect(stats.evictions).toBe(1);
    });

    test('Updates and Resurrection', () => {
        const cache = new MemoizationCache(2);
        cache.set(t1, 'old');
        cache.set(t2, 'b');
        // Cache: [t2, t1]

        cache.set(t3, 'c');
        // Evicts t1 (LRU) -> [t3, t2]

        expect(cache.get(t1)).toBeUndefined();

        // Set t1 again (Resurrection)
        cache.set(t1, 'new');
        // Cache: [t1, t3] (t2 evicted if size was 2? Wait.)
        // Initial: [t1]
        // [t2, t1]
        // [t3, t2] (t1 evicted)
        // [t1, t3] (t2 evicted)

        expect(cache.get(t1)).toBe('new');
        expect(cache.getStats().size).toBe(2);
    });
});
