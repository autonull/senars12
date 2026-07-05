import {Term} from '@senars/metta/src/kernel/Term.js';

const {sym, var: v, exp, clearSymbolTable, equals, isVar, isSymbol, isExpression} = Term;

describe('Kernel Term', () => {
    beforeEach(() => clearSymbolTable());

    test('sym creates interned atoms', () => {
        expect(sym('a')).toBe(sym('a'));
        expect(sym('a').type).toBe('atom');
        expect(sym('a').name).toBe('a');
    });

    test('var creates interned variables', () => {
        expect(v('x')).toBe(v('$x'));
        expect(v('x').name).toBe('$x');
        expect(v('?y').name).toBe('$y');
    });

    test('exp creates interned expressions with frozen components', () => {
        const e = exp('+', [sym('1'), sym('2')]);
        expect(e).toBe(exp('+', [sym('1'), sym('2')]));
        expect(e.toString()).toBe('(+ 1 2)');
        expect(Object.isFrozen(e.components)).toBe(true);
    });

    test('validates exp args', () => {
        expect(() => exp(null, [])).toThrow();
        expect(() => exp('+', 'fail')).toThrow();
    });

    test('structural equality', () => {
        expect(equals(sym('a'), sym('a'))).toBe(true);
        expect(equals(sym('a'), sym('b'))).toBe(false);

        expect(equals(exp('+', [sym('a')]), exp('+', [sym('a')]))).toBe(true);
        expect(equals(exp('+', [sym('a')]), exp('-', [sym('a')]))).toBe(false);
    });

    test('predicates', () => {
        expect(isVar(v('x'))).toBe(true);
        expect(isVar(sym('a'))).toBe(false);

        expect(isSymbol(sym('a'))).toBe(true);
        expect(isSymbol(v('x'))).toBe(false);

        expect(isExpression(exp('f', []))).toBe(true);
    });
});
