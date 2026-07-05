import {jest} from '@jest/globals';
import {deepClone, formatNumber, safeAsync, safeGet} from '@senars/core';

describe('Common Utils', () => {
    describe('safeGet', () => {
        const obj = {a: {b: {c: 1}}};
        test.each([
            ['existing nested value', obj, 'a.b.c', undefined, 1],
            ['non-existent path -> default', obj, 'a.b.d', 'def', 'def'],
            ['null parent -> default', null, 'a.b', 'def', 'def']
        ])('%s', (_, o, path, def, expected) => {
            expect(safeGet(o, path, def)).toBe(expected);
        });
    });

    describe('deepClone', () => {
        test('object', () => {
            const orig = {a: 1, b: {c: 2}, d: [3, 4]};
            const clone = deepClone(orig);
            expect(clone).toEqual(orig);
            expect(clone).not.toBe(orig);
            expect(clone.b).not.toBe(orig.b);
            expect(clone.d).not.toBe(orig.d);
        });

        test('Date', () => {
            const date = new Date('2023-01-01');
            const clone = deepClone(date);
            expect(clone).toEqual(date);
            expect(clone).not.toBe(date);
        });
    });

    describe('formatNumber', () => {
        test.each([
            ['decimals', 1.2345, 2, '1.23'],
            ['non-numbers (null)', null, undefined, '0'],
            ['non-numbers (string)', 'abc', undefined, 'abc']
        ])('%s', (_, val, prec, expected) => {
            expect(formatNumber(val, prec)).toBe(expected);
        });
    });

    describe('safeAsync', () => {
        test('resolves', async () => {
            await expect(safeAsync(async () => 'success', 'test', {}, null)).resolves.toBe('success');
        });

        test('catches error -> default', async () => {
            const spy = jest.spyOn(console, 'error').mockImplementation(() => {
            });
            const res = await safeAsync(async () => {
                throw new Error('fail');
            }, 'test', {}, 'def');
            expect(res).toBe('def');
            spy.mockRestore();
        });
    });
});
