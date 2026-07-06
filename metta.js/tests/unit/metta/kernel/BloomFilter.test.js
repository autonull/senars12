import {BloomFilter} from '../../../../metta/src/kernel/BloomFilter.js';

describe('BloomFilter', () => {
    let bloom;

    beforeEach(() => {
        bloom = new BloomFilter(100, 3);
        bloom.enabled = true;
    });

    test('adds and checks presence', () => {
        bloom.add('foo');
        expect(bloom.has('foo')).toBe(true);
    });

    test('returns false for absent items', () => {
        expect(bloom.has('bar')).toBe(false);
    });

    test('handles collisions (probabilistic)', () => {
        bloom.add('foo');
        bloom.add('bar');
        expect(bloom.has('foo')).toBe(true);
        expect(bloom.has('bar')).toBe(true);
    });

    test('works with numeric input', () => {
        bloom.add(123);
        expect(bloom.has('123')).toBe(true);
    });

    test('disabled filter always returns true', () => {
        bloom.enabled = false;
        expect(bloom.has('anything')).toBe(true);
    });
});
