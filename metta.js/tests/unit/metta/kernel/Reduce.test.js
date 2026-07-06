import {isGroundedCall, reduce, step} from '@senars/metta/src/kernel/Reduce.js';
import {Space} from '@senars/metta/src/kernel/Space.js';
import {Ground} from '@senars/metta/src/kernel/Ground.js';
import {Term} from '@senars/metta/src/kernel/Term.js';

describe('Kernel Reduce', () => {
    let space, ground;

    beforeEach(() => {
        Term.clearSymbolTable();
        space = new Space();
        ground = new Ground();
    });

    describe('step - Single reduction', () => {
        test('reduces using pattern rule', () => {
            // Rule: (double $x) -> (* 2 $x)
            const pattern = Term.exp('double', [Term.var('x')]);
            const result = Term.exp('*', [Term.sym('2'), Term.var('x')]);
            space.addRule(pattern, result);

            const query = Term.exp('double', [Term.sym('5')]);
            const {reduced, applied} = step(query, space, ground);

            expect(applied).toBe(true);
            expect(reduced.operator.name).toBe('*');
            expect(reduced.components[0].name).toBe('2');
            expect(reduced.components[1].name).toBe('5');
        });

        test('returns unchanged if no rule matches', () => {
            const query = Term.exp('unknown', [Term.sym('x')]);
            const {reduced, applied} = step(query, space, ground);

            expect(applied).toBe(false);
            expect(reduced).toBe(query);
        });

        test('supports function results', () => {
            const pattern = Term.exp('compute', [Term.var('x')]);
            const resultFn = (bindings) => Term.exp('+', [bindings['$x'], Term.sym('1')]);
            space.addRule(pattern, resultFn);

            const query = Term.exp('compute', [Term.sym('10')]);
            const {reduced, applied} = step(query, space, ground);

            expect(applied).toBe(true);
            expect(reduced.operator.name).toBe('+');
            expect(reduced.components[0].name).toBe('10');
        });

        test('uses functor index for fast lookup', () => {
            // Add multiple rules with different operators
            space.addRule(Term.exp('f', [Term.var('x')]), Term.sym('f-result'));
            space.addRule(Term.exp('g', [Term.var('x')]), Term.sym('g-result'));
            space.addRule(Term.exp('h', [Term.var('x')]), Term.sym('h-result'));

            const query = Term.exp('g', [Term.sym('test')]);
            const {reduced, applied} = step(query, space, ground);

            expect(applied).toBe(true);
            expect(reduced.name).toBe('g-result');
        });
    });

    describe('step - Grounded operations', () => {
        test('executes grounded operation', () => {
            const query = Term.exp('^', [Term.sym('&+'), Term.sym('2'), Term.sym('3')]);
            const {reduced, applied} = step(query, space, ground);

            expect(applied).toBe(true);
            expect(reduced.name).toBe('5');
        });

        test('handles grounded operation errors gracefully', () => {
            const query = Term.exp('^', [Term.sym('&unknown'), Term.sym('x')]);
            const {reduced, applied} = step(query, space, ground);

            expect(applied).toBe(false);
            expect(reduced).toBe(query);
        });
    });

    describe('reduce - Full reduction', () => {
        test('reduces to normal form', () => {
            // Rule: (double $x) -> (* 2 $x)
            space.addRule(
                Term.exp('double', [Term.var('x')]),
                Term.exp('*', [Term.sym('2'), Term.var('x')])
            );

            // Rule: (* $a $b) -> grounded multiplication
            space.addRule(
                Term.exp('*', [Term.var('a'), Term.var('b')]),
                (bindings) => {
                    const a = Number(bindings['$a'].name);
                    const b = Number(bindings['$b'].name);
                    return Term.sym(String(a * b));
                }
            );

            const query = Term.exp('double', [Term.sym('5')]);
            const result = reduce(query, space, ground);

            expect(result.name).toBe('10');
        });

        test('handles already-reduced terms', () => {
            const query = Term.sym('already-reduced');
            const result = reduce(query, space, ground);

            expect(result).toBe(query); // Same object
        });

        test('throws on max steps exceeded', () => {
            // Infinite loop rule: (loop $x) -> (loop $x)
            space.addRule(
                Term.exp('loop', [Term.var('x')]),
                Term.exp('loop', [Term.var('x')])
            );

            const query = Term.exp('loop', [Term.sym('test')]);

            expect(() => reduce(query, space, ground, 10)).toThrow(/Max steps/);
        });

        test('multi-step reduction', () => {
            // Rule 1: (inc $x) -> (+ $x 1)
            space.addRule(
                Term.exp('inc', [Term.var('x')]),
                Term.exp('+', [Term.var('x'), Term.sym('1')])
            );

            // Rule 2: (+ $a $b) -> grounded addition
            space.addRule(
                Term.exp('+', [Term.var('a'), Term.var('b')]),
                (bindings) => {
                    const a = Number(bindings['$a'].name);
                    const b = Number(bindings['$b'].name);
                    return Term.sym(String(a + b));
                }
            );

            const query = Term.exp('inc', [Term.sym('5')]);
            const result = reduce(query, space, ground);

            expect(result.name).toBe('6');
        });
    });

    describe('isGroundedCall', () => {
        test('detects grounded calls', () => {
            const call = Term.exp('^', [Term.sym('&+'), Term.sym('1')]);
            expect(isGroundedCall(call, ground)).toBe(true);
        });

        test('non-grounded calls return false', () => {
            const call = Term.exp('f', [Term.sym('x')]);
            expect(isGroundedCall(call, ground)).toBe(false);
        });

        test('unknown grounded operation returns false', () => {
            const call = Term.exp('^', [Term.sym('&unknown')]);
            expect(isGroundedCall(call, ground)).toBe(false);
        });

        test('atomic terms are not grounded calls', () => {
            const atom = Term.sym('foo');
            expect(isGroundedCall(atom, ground)).toBe(false);
        });
    });

    describe('Integration scenarios', () => {
        test('fibonacci reduction', () => {
            // Base cases
            space.addRule(Term.exp('fib', [Term.sym('0')]), Term.sym('0'));
            space.addRule(Term.exp('fib', [Term.sym('1')]), Term.sym('1'));

            const fib0 = reduce(Term.exp('fib', [Term.sym('0')]), space, ground);
            const fib1 = reduce(Term.exp('fib', [Term.sym('1')]), space, ground);

            expect(fib0.name).toBe('0');
            expect(fib1.name).toBe('1');
        });

        test('arithmetic expression simplification', () => {
            // Rule: (+ $x 0) -> $x
            space.addRule(
                Term.exp('+', [Term.var('x'), Term.sym('0')]),
                Term.var('x')
            );

            const expr = Term.exp('+', [Term.sym('foo'), Term.sym('0')]);
            const result = reduce(expr, space, ground);

            expect(result.name).toBe('foo');
        });

        test('mixed rules and grounded operations', () => {
            // Rule: (square $x) -> (* $x $x)
            space.addRule(
                Term.exp('square', [Term.var('x')]),
                Term.exp('*', [Term.var('x'), Term.var('x')])
            );

            // Use grounded multiplication
            space.addRule(
                Term.exp('*', [Term.var('a'), Term.var('b')]),
                (bindings) => {
                    const a = extractNum(bindings['$a']);
                    const b = extractNum(bindings['$b']);
                    return Term.sym(String(a * b));
                }
            );

            const query = Term.exp('square', [Term.sym('7')]);
            const result = reduce(query, space, ground);

            expect(result.name).toBe('49');
        });
        test('reduces operator expression before application', () => {
            // Rule: (make-op) -> inc
            space.addRule(Term.exp('make-op', []), Term.sym('inc'));

            // Rule: (inc $x) -> (+ $x 1)
            space.addRule(
                Term.exp('inc', [Term.var('x')]),
                Term.exp('+', [Term.var('x'), Term.sym('1')])
            );

            // Rule: (+ $a $b) -> grounded addition
            space.addRule(
                Term.exp('+', [Term.var('a'), Term.var('b')]),
                (bindings) => {
                    const a = Number(bindings['$a'].name);
                    const b = Number(bindings['$b'].name);
                    return Term.sym(String(a + b));
                }
            );

            // Query: ((make-op) 5) -> (inc 5) -> (+ 5 1) -> 6
            const query = Term.exp(Term.exp('make-op', []), [Term.sym('5')]);
            const result = reduce(query, space, ground);

            expect(result.name).toBe('6');
        });
    });
});

function extractNum(term) {
    return Number(term.name);
}
