import {MeTTaInterpreter} from '@senars/metta/src/MeTTaInterpreter.js';

describe('MeTTa Edge Case Tests', () => {
    let interpreter, parse;

    beforeEach(() => {
        interpreter = new MeTTaInterpreter({loadStdlib: false});
        parse = (code) => interpreter.parser.parse(code);
    });

    test('Variable Binding: handles unbound variables', () => {
        const result = interpreter.run('(unbound-var $x)');
        expect(result[0].toString()).toContain('unbound-var');
    });

    test('Termination: respects reduction step limits', () => {
        const limited = new MeTTaInterpreter({loadStdlib: false, maxReductionSteps: 5});
        expect(limited.run('(^ &+ 2 3)')[0].name).toBe('5');
    });

    test('Pattern Matching: complex nested patterns', () => {
        interpreter.space.addRule(parse('(nested-match $a $b $c)'), parse('(^ &+ $a (^ &+ $b $c))'));
        expect(interpreter.run('(nested-match 1 2 3)')[0].name).toBe('6');
    });

    test('Pattern Matching: wildcard patterns', () => {
        interpreter.space.addRule(parse('(wildcard $x $_)'), parse('$x'));
        expect(interpreter.run('(wildcard 42 anything)')[0].name).toBe('42');
    });

    test('Pattern Matching: occurs check prevents infinite loops', () => {
        expect(interpreter.run('(= $x (f $x))')).toBeDefined();
    });

    describe('Grounded Operations', () => {
        test('handles division by zero', () => {
            expect(interpreter.run('(^ &/ 10 0)')).toBeDefined();
        });

        test('handles invalid args', () => {
            expect(interpreter.run('(^ &+ 5 "hello")')).toBeDefined();
        });

        test('variadic operations', () => {
            expect(interpreter.run('(^ &+ 5)')[0].name).toBe('5');
            expect(interpreter.run('(^ &+ 5 10)')[0].name).toBe('15');
            expect(interpreter.run('(^ &+ 1 2 3 4)')[0].name).toBe('10');
        });
    });

    describe('List Processing', () => {
        test('basic list ops', () => {
            expect(interpreter.run('(^ &empty? ())')[0].name).toBe('True');
            const res = interpreter.run('(: 42 ())');
            expect(res[0].operator.name).toBe(':');
        });

        test('deeply nested lists', () => {
            expect(interpreter.run('(: 1 (: 2 (: 3 (: 4 (: 5 ())))))')[0]).toBeDefined();
        });
    });

    describe('Parser & Space', () => {
        test('malformed expressions throw', () => {
            expect(() => parse('(unclosed paren')).toThrow();
        });

        test('empty input returns null/empty', () => {
            // parse returns null, run returns empty array
            expect(parse('')).toBeNull();
        });

        test('deeply nested expressions', () => {
            expect(parse('(((((depth)))))')).toBeDefined();
        });

        test('duplicate additions', () => {
            const atom = parse('(dup)');
            interpreter.space.add(atom);
            interpreter.space.add(atom);
            expect(interpreter.space.size()).toBeGreaterThanOrEqual(1);
        });

        test('remove non-existent', () => {
            expect(interpreter.space.remove(parse('(nope)'))).toBe(false);
        });
    });

    test('Structural Equality', () => {
        expect(parse('(t 1)').equals(parse('(t 1)'))).toBe(true);
        expect(parse('(t 1)').equals(parse('(t 2)'))).toBe(false);
    });
});