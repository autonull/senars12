import {describe, expect, it} from 'vitest';
import {selectTopN} from '../../../nar/src/utils/collections.js';

const arr = [5, 1, 3, 9, 2, 8, 4, 7, 0, 6];
const old = (n: number) => [...arr].sort((a, b) => b - a).slice(0, n);
const sortedDesc = (x: number[]) => x.every((v, i) => i === 0 || x[i - 1]! >= v);

describe('selectTopN', () => {
    it('matches full sort for various n', () => {
        for (const n of [0, 1, 3, 5, 10, 20]) {
            const got = selectTopN(arr, n, (x) => x);
            expect(got).toEqual(old(n));
            expect(sortedDesc(got)).toBe(true);
        }
    });
    it('handles ties', () => {
        const tie = [2, 1, 2, 1, 2];
        expect(selectTopN(tie, 3, (x) => x)).toEqual([...tie].sort((a, b) => b - a).slice(0, 3));
    });
    it('handles empty iterable', () => {
        expect(selectTopN([], 3, (x) => x)).toEqual([]);
    });
    it('returns empty for n<=0', () => {
        expect(selectTopN(arr, 0, (x) => x)).toEqual([]);
    });
});
