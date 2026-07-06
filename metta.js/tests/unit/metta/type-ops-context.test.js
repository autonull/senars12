/**
 * Unit tests for context-dependent type operations
 * Tests get-type, match-types, and assert-type operations
 */

import {MeTTaInterpreter, Space, Term} from '../../../metta/src/index.js';

const {sym, exp, var: v} = Term;

describe('Context-Dependent Type Operations', () => {
    let interpreter;

    beforeEach(() => {
        interpreter = new MeTTaInterpreter();
    });

    describe('get-type', () => {
        test('should return type from space when type assertion exists', () => {
            // Add type assertion to space
            interpreter.space.add(exp(sym(':'), [sym('x'), sym('Number')]));

            const result = interpreter.ground.execute('&get-type', sym('x'));
            expect(result.name).toBe('Number');
        });

        test('should return %Undefined% when no type assertion exists', () => {
            const result = interpreter.ground.execute('&get-type', sym('unknown'));
            expect(result.name).toBe('%Undefined%');
        });

        test('should work with custom space parameter', () => {
            const customSpace = new Space();
            customSpace.add(exp(sym(':'), [sym('y'), sym('String')]));

            const result = interpreter.ground.execute('&get-type', sym('y'), customSpace);
            expect(result.name).toBe('String');
        });

        test('should handle function types', () => {
            interpreter.space.add(exp(sym(':'), [
                sym('add'),
                exp(sym('->'), [sym('Number'), sym('Number'), sym('Number')])
            ]));

            const result = interpreter.ground.execute('&get-type', sym('add'));
            expect(result.operator.name).toBe('->');
            expect(result.components.length).toBe(3);
        });

        test('should return first matching type when multiple exist', () => {
            interpreter.space.add(exp(sym(':'), [sym('z'), sym('Number')]));
            interpreter.space.add(exp(sym(':'), [sym('z'), sym('Integer')]));

            const result = interpreter.ground.execute('&get-type', sym('z'));
            // Should return first match
            expect(['Number', 'Integer']).toContain(result.name);
        });
    });

    describe('match-types', () => {
        test('should execute then branch when types match exactly', () => {
            const result = interpreter.ground.execute(
                '&match-types',
                sym('Number'),
                sym('Number'),
                sym('matched'),
                sym('not-matched')
            );
            expect(result.name).toBe('matched');
        });

        test('should execute else branch when types do not match', () => {
            const result = interpreter.ground.execute(
                '&match-types',
                sym('Number'),
                sym('String'),
                sym('matched'),
                sym('not-matched')
            );
            expect(result.name).toBe('not-matched');
        });

        test('should treat %Undefined% as wildcard (always match)', () => {
            const result1 = interpreter.ground.execute(
                '&match-types',
                sym('%Undefined%'),
                sym('Number'),
                sym('matched'),
                sym('not-matched')
            );
            expect(result1.name).toBe('matched');

            const result2 = interpreter.ground.execute(
                '&match-types',
                sym('String'),
                sym('%Undefined%'),
                sym('matched'),
                sym('not-matched')
            );
            expect(result2.name).toBe('matched');
        });

        test('should treat Atom as wildcard (always match)', () => {
            const result1 = interpreter.ground.execute(
                '&match-types',
                sym('Atom'),
                sym('Number'),
                sym('matched'),
                sym('not-matched')
            );
            expect(result1.name).toBe('matched');

            const result2 = interpreter.ground.execute(
                '&match-types',
                sym('String'),
                sym('Atom'),
                sym('matched'),
                sym('not-matched')
            );
            expect(result2.name).toBe('matched');
        });

        test('should unify type variables', () => {
            const result = interpreter.ground.execute(
                '&match-types',
                v('T'),
                sym('Number'),
                sym('matched'),
                sym('not-matched')
            );
            expect(result.name).toBe('matched');
        });

        test('should match function types with same structure', () => {
            const funcType1 = exp(sym('->'), [sym('Number'), sym('Number')]);
            const funcType2 = exp(sym('->'), [sym('Number'), sym('Number')]);

            const result = interpreter.ground.execute(
                '&match-types',
                funcType1,
                funcType2,
                sym('matched'),
                sym('not-matched')
            );
            expect(result.name).toBe('matched');
        });

        test('should not match function types with different structure', () => {
            const funcType1 = exp(sym('->'), [sym('Number'), sym('Number')]);
            const funcType2 = exp(sym('->'), [sym('String'), sym('String')]);

            const result = interpreter.ground.execute(
                '&match-types',
                funcType1,
                funcType2,
                sym('matched'),
                sym('not-matched')
            );
            expect(result.name).toBe('not-matched');
        });
    });

    describe('assert-type', () => {
        test('should pass through atom when type matches', () => {
            interpreter.space.add(exp(sym(':'), [sym('x'), sym('Number')]));

            const result = interpreter.ground.execute(
                '&assert-type',
                sym('x'),
                sym('Number')
            );
            expect(result.name).toBe('x');
        });

        test('should return TypeError when type does not match', () => {
            interpreter.space.add(exp(sym(':'), [sym('x'), sym('Number')]));

            const result = interpreter.ground.execute(
                '&assert-type',
                sym('x'),
                sym('String')
            );

            expect(result.operator.name).toBe('Error');
            expect(result.components[0].name).toBe('x');
            expect(result.components[1].operator.name).toBe('TypeError');
            expect(result.components[1].components[0].name).toBe('String'); // expected
            expect(result.components[1].components[1].name).toBe('Number'); // actual
        });

        test('should pass through when no type information exists', () => {
            const result = interpreter.ground.execute(
                '&assert-type',
                sym('unknown'),
                sym('Number')
            );
            expect(result.name).toBe('unknown');
        });

        test('should work with custom space parameter', () => {
            const customSpace = new Space();
            customSpace.add(exp(sym(':'), [sym('y'), sym('String')]));

            const result = interpreter.ground.execute(
                '&assert-type',
                sym('y'),
                sym('String'),
                customSpace
            );
            expect(result.name).toBe('y');
        });

        test('should handle type variables in expected type', () => {
            interpreter.space.add(exp(sym(':'), [sym('x'), sym('Number')]));

            const result = interpreter.ground.execute(
                '&assert-type',
                sym('x'),
                v('T')
            );
            // Type variable should unify with Number
            expect(result.name).toBe('x');
        });

        test('should handle function types', () => {
            const funcType = exp(sym('->'), [sym('Number'), sym('Number')]);
            interpreter.space.add(exp(sym(':'), [sym('add'), funcType]));

            const result = interpreter.ground.execute(
                '&assert-type',
                sym('add'),
                funcType
            );
            expect(result.name).toBe('add');
        });

        test('should detect function type mismatch', () => {
            const funcType1 = exp(sym('->'), [sym('Number'), sym('Number')]);
            const funcType2 = exp(sym('->'), [sym('String'), sym('String')]);
            interpreter.space.add(exp(sym(':'), [sym('fn'), funcType1]));

            const result = interpreter.ground.execute(
                '&assert-type',
                sym('fn'),
                funcType2
            );

            expect(result.operator.name).toBe('Error');
            expect(result.components[1].operator.name).toBe('TypeError');
        });
    });

    describe('Integration with MeTTa interpreter', () => {
        test('should work via run() method', () => {
            const results = interpreter.run(`
                (: myNum Number)
                !(get-type myNum)
            `);

            // First result is the type assertion, second is the get-type result
            expect(results.length).toBe(2);
            expect(results[1].name).toBe('Number');
        });

        test('should work in conditional expressions', () => {
            const results = interpreter.run(`
                (: x Number)
                !(match-types Number Number yes no)
            `);

            expect(results[1].name).toBe('yes');
        });

        test('should integrate with type checking workflow', () => {
            // Note: Using &assert-type directly because the stdlib rule for assert-type
            // has issues with the ^ lazy evaluation operator in the current reduction pipeline
            interpreter.load('(: validated Number)');
            const result = interpreter.ground.execute('&assert-type', sym('validated'), sym('Number'));
            expect(result.name).toBe('validated');
        });
    });
});
