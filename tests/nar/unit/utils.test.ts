import {clamp, computeHash, ensureArray, fnv1a, isNil, makeId, safeDiv} from '../../../src/nar/utils';

describe('helpers', () => {
    describe('clamp', () => {
        test('keeps value in range', () => {
            expect(clamp(0.5, 0, 1)).toBe(0.5);
        });

        test('clamps below min', () => {
            expect(clamp(-0.5, 0, 1)).toBe(0);
        });

        test('clamps above max', () => {
            expect(clamp(1.5, 0, 1)).toBe(1);
        });
    });

    describe('safeDiv', () => {
        test('divides normally', () => {
            expect(safeDiv(0.5, 2)).toBe(0.25);
        });

        test('returns 0 when denominator is 0', () => {
            expect(safeDiv(0.5, 0)).toBe(0);
        });

        test('clamps result to 0-1', () => {
            expect(safeDiv(5, 2)).toBe(1);
        });
    });

    describe('makeId', () => {
        test('creates unique ids', () => {
            const id1 = makeId();
            const id2 = makeId();
            expect(id1).not.toBe(id2);
        });

        test('creates valid UUIDs', () => {
            const id = makeId();
            expect(id).toMatch(/^[0-9a-f-]{36}$/);
        });
    });

    describe('isNil', () => {
        test('checks null', () => {
            expect(isNil(null)).toBe(true);
        });

        test('checks undefined', () => {
            expect(isNil(undefined)).toBe(true);
        });

        test('rejects other values', () => {
            expect(isNil(0)).toBe(false);
            expect(isNil('')).toBe(false);
            expect(isNil(false)).toBe(false);
        });
    });

    describe('ensureArray', () => {
        test('wraps single value', () => {
            expect(ensureArray('a')).toEqual(['a']);
        });

        test('passes array through', () => {
            expect(ensureArray(['a', 'b'])).toEqual(['a', 'b']);
        });

        test('handles null/undefined', () => {
            expect(ensureArray(null)).toEqual([]);
            expect(ensureArray(undefined)).toEqual([]);
        });
    });
});

describe('hash', () => {
    describe('fnv1a', () => {
        test('is deterministic', () => {
            expect(fnv1a('test')).toBe(fnv1a('test'));
        });

        test('is case sensitive', () => {
            expect(fnv1a('Test')).not.toBe(fnv1a('test'));
        });

        test('produces positive number', () => {
            expect(fnv1a('test')).toBeGreaterThan(0);
        });
    });

    describe('computeHash', () => {
        test('combines multiple values', () => {
            const h = computeHash('test', [1, 2, 3]);
            expect(h).toBeDefined();
        });

        test('is order independent (always sorts args)', () => {
            const h1 = computeHash('conjunction', [1, 2, 3]);
            const h2 = computeHash('conjunction', [3, 2, 1]);
            expect(h1).toBe(h2);
        });

        test('conjunction (commutative) produces same hash regardless of order', () => {
            const h = computeHash('conjunction', [1, 5, 3]);
            const h2 = computeHash('conjunction', [5, 3, 1]);
            expect(h).toBe(h2);
        });

        test('inheritance (non-commutative) produces different hash for different order', () => {
            const h = computeHash('inheritance', [1, 5, 3]);
            const h2 = computeHash('inheritance', [5, 3, 1]);
            expect(h).not.toBe(h2);
        });
    });
});