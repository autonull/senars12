import {GenerationalPool, ObjectPool} from '../../../../metta/src/kernel/Pool.js';

describe('ObjectPool', () => {
    test('reuses objects', () => {
        const pool = new ObjectPool(() => ({id: Math.random()}), (o) => {
        });
        const obj1 = pool.acquire();
        pool.release(obj1);
        const obj2 = pool.acquire();
        expect(obj2).toBe(obj1);
    });

    test('creates new objects when empty', () => {
        const pool = new ObjectPool(() => ({id: Math.random()}), (o) => {
        }, 0);
        const obj1 = pool.acquire();
        const obj2 = pool.acquire();
        expect(obj1).not.toBe(obj2);
    });

    test('resets objects on release', () => {
        const pool = new ObjectPool(() => ({val: 0}), (o) => {
            o.val = 0;
        });
        const obj = pool.acquire();
        obj.val = 123;
        pool.release(obj);
        const reused = pool.acquire();
        expect(reused.val).toBe(0);
    });
});

describe('GenerationalPool', () => {
    test('promotes objects after threshold', () => {
        const pool = new GenerationalPool(
            () => ({}),
            () => {
            },
            {promotionThreshold: 2, youngLimit: 10}
        );

        const obj = pool.acquire(); // Age 0
        pool.release(obj); // Into young gen

        const reused1 = pool.acquire(); // Age 1
        expect(reused1).toBe(obj);
        pool.release(reused1); // Into young gen

        const reused2 = pool.acquire(); // Age 2 (in map)
        expect(reused2).toBe(obj);
        // Promotion happens when moving TO old gen (at release time)
        // or when pulled from young gen and found to be old (lazy)

        pool.release(reused2); // Age 2 >= Threshold (2) -> Into old gen

        expect(pool.stats.promotions).toBe(1);
        expect(pool.oldGenSize).toBe(1);
    });
});
