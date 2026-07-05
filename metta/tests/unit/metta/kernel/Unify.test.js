import {Unify} from '@senars/metta/src/kernel/Unify.js';
import {Term} from '@senars/metta/src/kernel/Term.js';

const {sym, var: v, exp, clearSymbolTable} = Term;

describe('Kernel Unify', () => {
    beforeEach(() => clearSymbolTable());

    describe('isVar', () => {
        test('detects variables', () => expect(Unify.isVar(v('x'))).toBe(true));
        test('rejects atoms', () => expect(Unify.isVar(sym('foo'))).toBe(false));
        test('rejects expressions', () => expect(Unify.isVar(exp('+', [sym('1')]))).toBe(false));
    });

    describe('unify', () => {
        test('unifies variable with term', () => {
            const b = Unify.unify(v('x'), sym('foo'));
            expect(b['$x']).toEqual(sym('foo'));
        });

        test('unifies matching atoms', () => expect(Unify.unify(sym('a'), sym('a'))).toEqual({}));
        test('fails different atoms', () => expect(Unify.unify(sym('a'), sym('b'))).toBeNull());

        test('unifies two variables', () => {
            const b = Unify.unify(v('x'), v('y'));
            expect(b['$x'] || b['$y']).toBeTruthy();
        });

        test('unifies compound matching', () => {
            const b = Unify.unify(exp('+', [v('x'), v('y')]), exp('+', [sym('1'), sym('2')]));
            expect(b['$x'].name).toBe('1');
            expect(b['$y'].name).toBe('2');
        });

        test('fails different operators', () => {
            expect(Unify.unify(exp('+', [v('x')]), exp('-', [sym('1')]))).toBeNull();
        });

        test('fails arity mismatch', () => {
            expect(Unify.unify(exp('+', [v('x')]), exp('+', [sym('1'), sym('2')]))).toBeNull();
        });

        test('uses existing bindings', () => {
            const b = Unify.unify(v('x'), sym('val'), {'$x': sym('val')});
            expect(b).toEqual({'$x': sym('val')});
        });

        test('fails conflicting bindings', () => {
            expect(Unify.unify(v('x'), sym('new'), {'$x': sym('old')})).toBeNull();
        });

        test('occurs check', () => {
            expect(Unify.unify(v('x'), exp('f', [v('x')]))).toBeNull();
        });
    });

    describe('subst', () => {
        test('substitutes variable', () => {
            expect(Unify.subst(v('x'), {'$x': sym('42')}).name).toBe('42');
        });

        test('substitutes compound', () => {
            const r = Unify.subst(exp('+', [v('x'), sym('1')]), {'$x': sym('5')});
            expect(r.components[0].name).toBe('5');
            expect(r.components[1].name).toBe('1');
        });

        test('transitive substitution', () => {
            // Basic subst might not be transitive by itself depending on implementation depth, 
            // but verify expected behavior.
            // If $x -> $y and $y -> val, subst($x) -> $y (single step usually) or val? 
            // Unify.subst usually does shallow or deep?
            // Based on `safeSubstitute` implementation (recursive on variable if bound), it should follow chain.
            // Wait, `safeSubstitute` recurses: `if (val !== undefined && val !== term) return safeSubstitute(val, bindings);`
            // So it should be transitive.
            const r = Unify.subst(v('x'), {'$x': v('y'), '$y': sym('val')});
            expect(r.name).toBe('val');
        });
    });

    describe('matchAll', () => {
        test('finds all matches', () => {
            const p = exp('f', [v('x')]);
            const ts = [exp('f', [sym('a')]), exp('f', [sym('b')]), exp('g', [sym('c')])];
            const m = Unify.matchAll([p], ts);
            expect(m).toHaveLength(2);
            expect(m[0].term).toBe(ts[0]);
            expect(m[1].term).toBe(ts[1]);
        });
    });
});
