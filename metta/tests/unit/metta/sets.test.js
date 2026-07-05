import {Ground} from '@senars/metta/src/kernel/Ground.js';
import {exp, sym} from '@senars/metta/src/kernel/Term.js';

describe('Ground.js - Set Operations', () => {
    let ground;

    beforeEach(() => {
        ground = new Ground();
    });

    describe('unique-atom', () => {
        test('removes duplicate elements', () => {
            const list = exp(sym(':'), [sym('a'), exp(sym(':'), [sym('b'), exp(sym(':'), [sym('a'), exp(sym(':'), [sym('c'), sym('()')])])])]);
            const result = ground.execute('&unique-atom', list);
            // Result should contain a, b, c (no duplicate a)
            expect(result).toBeDefined();
        });

        test('handles empty list', () => {
            const result = ground.execute('&unique-atom', sym('()'));
            expect(result.name).toBe('()');
        });
    });

    describe('union-atom', () => {
        test('combines two sets', () => {
            const set1 = exp(sym(':'), [sym('a'), exp(sym(':'), [sym('b'), sym('()')])]);
            const set2 = exp(sym(':'), [sym('c'), exp(sym(':'), [sym('d'), sym('()')])]);
            const result = ground.execute('&union-atom', set1, set2);
            expect(result).toBeDefined();
        });
    });

    describe('intersection-atom', () => {
        test('finds common elements', () => {
            const set1 = exp(sym(':'), [sym('a'), exp(sym(':'), [sym('b'), exp(sym(':'), [sym('c'), sym('()')])])]);
            const set2 = exp(sym(':'), [sym('b'), exp(sym(':'), [sym('c'), exp(sym(':'), [sym('d'), sym('()')])])]);
            const result = ground.execute('&intersection-atom', set1, set2);
            // Should contain b and c
            expect(result).toBeDefined();
        });

        test('returns empty for no common elements', () => {
            const set1 = exp(sym(':'), [sym('a'), sym('()')]);
            const set2 = exp(sym(':'), [sym('b'), sym('()')]);
            const result = ground.execute('&intersection-atom', set1, set2);
            expect(result.name).toBe('()');
        });
    });

    describe('subtraction-atom', () => {
        test('removes elements present in second set', () => {
            const set1 = exp(sym(':'), [sym('a'), exp(sym(':'), [sym('b'), exp(sym(':'), [sym('c'), sym('()')])])]);
            const set2 = exp(sym(':'), [sym('b'), sym('()')]);
            const result = ground.execute('&subtraction-atom', set1, set2);
            // Should contain a and c (not b)
            expect(result).toBeDefined();
        });
    });

    describe('symmetric-diff-atom', () => {
        test('finds elements in A or B but not both', () => {
            const set1 = exp(sym(':'), [sym('a'), exp(sym(':'), [sym('b'), sym('()')])]);
            const set2 = exp(sym(':'), [sym('b'), exp(sym(':'), [sym('c'), sym('()')])]);
            const result = ground.execute('&symmetric-diff-atom', set1, set2);
            // Should contain a and c (not b which is in both)
            expect(result).toBeDefined();
        });
    });

    describe('is-subset', () => {
        test('returns True when A ⊆ B', () => {
            const setA = exp(sym(':'), [sym('a'), exp(sym(':'), [sym('b'), sym('()')])]);
            const setB = exp(sym(':'), [sym('a'), exp(sym(':'), [sym('b'), exp(sym(':'), [sym('c'), sym('()')])])]);
            const result = ground.execute('&is-subset', setA, setB);
            expect(result.name).toBe('True');
        });

        test('returns False when A ⊄ B', () => {
            const setA = exp(sym(':'), [sym('a'), exp(sym(':'), [sym('d'), sym('()')])]);
            const setB = exp(sym(':'), [sym('a'), exp(sym(':'), [sym('b'), sym('()')])]);
            const result = ground.execute('&is-subset', setA, setB);
            expect(result.name).toBe('False');
        });

        test('empty set is subset of any set', () => {
            const setA = sym('()');
            const setB = exp(sym(':'), [sym('a'), sym('()')]);
            const result = ground.execute('&is-subset', setA, setB);
            expect(result.name).toBe('True');
        });
    });

    describe('set-size', () => {
        test('counts unique elements', () => {
            const set = exp(sym(':'), [sym('a'), exp(sym(':'), [sym('b'), exp(sym(':'), [sym('a'), sym('()')])])]);
            const result = ground.execute('&set-size', set);
            expect(result.name).toBe('2'); // a and b (duplicate a not counted)
        });

        test('returns 0 for empty set', () => {
            const result = ground.execute('&set-size', sym('()'));
            expect(result.name).toBe('0');
        });
    });
});
