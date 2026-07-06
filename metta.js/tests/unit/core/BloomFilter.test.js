import {BloomFilter} from '@senars/core/src/util/BloomFilter';

describe('BloomFilter', () => {
    test('initialization', () => {
        const bf = new BloomFilter(100, 3);
        expect(bf.size).toBe(100);
        expect(bf.hashes).toBe(3);
    });

    test('add and test', () => {
        const bf = new BloomFilter(100, 3);
        bf.add('test1');
        bf.add('test2');

        expect(bf.test('test1')).toBe(true);
        expect(bf.test('test2')).toBe(true);
        expect(bf.test('test3')).toBe(false); // Likely false
    });

    test('merge', () => {
        const bf1 = new BloomFilter(100, 3);
        bf1.add('item1');

        const bf2 = new BloomFilter(100, 3);
        bf2.add('item2');

        bf1.merge(bf2);

        expect(bf1.test('item1')).toBe(true);
        expect(bf1.test('item2')).toBe(true);
    });

    test('equals', () => {
        const bf1 = new BloomFilter(100, 3);
        bf1.add('item1');

        const bf2 = new BloomFilter(100, 3);
        bf2.add('item1');

        expect(bf1.equals(bf2)).toBe(true);

        bf2.add('item2');
        expect(bf1.equals(bf2)).toBe(false);
    });

    test('intersects', () => {
        const bf1 = new BloomFilter(100, 3);
        bf1.add('common');
        bf1.add('a');

        const bf2 = new BloomFilter(100, 3);
        bf2.add('common');
        bf2.add('b');

        const bf3 = new BloomFilter(100, 3);
        bf3.add('x');
        bf3.add('y');

        expect(bf1.intersects(bf2)).toBe(true);
        expect(bf1.intersects(bf3)).toBe(false); // Assuming no collision
    });
});
