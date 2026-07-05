/**
 * Unit Tests for Grounded HOF Operations
 * Tests &map-fast, &filter-fast, &foldl-fast
 */

import {MeTTaTestUtils} from '../../helpers/MeTTaTestUtils.js';

describe('Grounded HOF Operations', () => {
    let interpreter;

    beforeEach(() => {
        interpreter = MeTTaTestUtils.createInterpreter({loadStdlib: true});
    });

    describe('&map-fast', () => {
        test('map with grounded function reference', () => {
            // Define a named function
            interpreter.load('(= (double $x) (* $x 2))');

            // Use &map-fast with function reference
            const result = interpreter.run('(^ &map-fast double (: 1 (: 2 (: 3 ()))))');

            expect(result).toHaveLength(1);
            const list = result[0];

            // Extract elements
            const elements = [];
            let current = list;
            while (current && current.operator?.name === ':') {
                elements.push(current.components[0].name);
                current = current.components[1];
            }

            expect(elements).toEqual(['2', '4', '6']);
        });

        test('map with empty list returns empty', () => {
            interpreter.load('(= (double $x) (* $x 2))');
            const result = interpreter.run('(^ &map-fast double ())');

            expect(result).toHaveLength(1);
            expect(result[0].name).toBe('()');
        });
    });

    describe('&filter-fast', () => {
        test('filter with predicate function', () => {
            // Define a predicate
            interpreter.load('(= (is-positive $x) (\u003e $x 0))');

            const result = interpreter.run('(^ &filter-fast is-positive (: -1 (: 2 (: -3 (: 4 ())))))');

            expect(result).toHaveLength(1);
            const list = result[0];

            // Extract elements
            const elements = [];
            let current = list;
            while (current && current.operator?.name === ':') {
                elements.push(current.components[0].name);
                current = current.components[1];
            }

            expect(elements).toEqual(['2', '4']);
        });

        test('filter with no matches returns empty', () => {
            interpreter.load('(= (is-positive $x) (\u003e $x 0))');
            const result = interpreter.run('(^ &filter-fast is-positive (: -1 (: -2 ())))');

            expect(result).toHaveLength(1);
            expect(result[0].name).toBe('()');
        });

        test('filter empty list returns empty', () => {
            interpreter.load('(= (is-positive $x) (\u003e $x 0))');
            const result = interpreter.run('(^ &filter-fast is-positive ())');

            expect(result).toHaveLength(1);
            expect(result[0].name).toBe('()');
        });
    });

    describe('&foldl-fast', () => {
        test('foldl accumulates from left', () => {
            // Use grounded + operator
            const result = interpreter.run('(^ &foldl-fast + 0 (: 1 (: 2 (: 3 ()))))');

            expect(result).toHaveLength(1);
            expect(result[0].name).toBe('6');
        });

        test('foldl with custom accumulator function', () => {
            // Define accumulator: multiply and add
            interpreter.load('(= (add-prod $acc $x) (+ $acc (* $x 2)))');

            const result = interpreter.run('(^ &foldl-fast add-prod 0 (: 1 (: 2 (: 3 ()))))');

            expect(result).toHaveLength(1);
            // 0 + 2 = 2, 2 + 4 = 6, 6 + 6 = 12
            expect(result[0].name).toBe('12');
        });

        test('foldl with empty list returns init value', () => {
            const result = interpreter.run('(^ &foldl-fast + 100 ())');

            expect(result).toHaveLength(1);
            expect(result[0].name).toBe('100');
        });
    });

    describe('Integration Tests', () => {
        test('chain map and filter operations', () => {
            interpreter.load(`
                (= (double $x) (* $x 2))
                (= (is-even $x) (== (% $x 2) 0))
            `);

            // Double all numbers
            const doubled = interpreter.run('(^ &map-fast double (: 1 (: 2 (: 3 (: 4 ())))))');
            // Result should be (: 2 (: 4 (: 6 (: 8 ()))))

            expect(doubled).toHaveLength(1);

            // Filter for even (all should be even after doubling)
            const filtered = interpreter.run(`(^ &filter-fast is-even ${doubled[0].toString()})`);

            expect(filtered).toHaveLength(1);

            // Count should be 4
            const elements = [];
            let current = filtered[0];
            while (current && current.operator?.name === ':') {
                elements.push(current.components[0].name);
                current = current.components[1];
            }

            expect(elements.length).toBe(4);
        });

        test('map, filter, then fold pipeline', () => {
            interpreter.load(`
                (= (triple $x) (* $x 3))
                (= (is-positive $x) (\u003e $x 0))
            `);

            // Map: triple each
            const mapped = interpreter.run('(^ &map-fast triple (: 1 (: 2 (: 3 ()))))');
            // Result: (: 3 (: 6 (: 9 ())))

            // Filter: keep positive (all are)
            const filtered = interpreter.run(`(^ &filter-fast is-positive ${mapped[0].toString()})`);

            // Fold: sum
            const result = interpreter.run(`(^ &foldl-fast + 0 ${filtered[0].toString()})`);

            expect(result[0].name).toBe('18'); // 3 + 6 + 9 = 18
        });
    });
});
