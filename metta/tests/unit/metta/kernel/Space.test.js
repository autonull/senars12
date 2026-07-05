import {Space} from '@senars/metta/src/kernel/Space.js';
import {Term} from '@senars/metta/src/kernel/Term.js';

const {sym, var: v, exp, clearSymbolTable} = Term;

describe('Kernel Space', () => {
    let space;
    beforeEach(() => {
        clearSymbolTable();
        space = new Space();
    });

    test('adds and retrieves atoms', () => {
        const atom = sym('A');
        space.add(atom);
        expect(space.has(atom)).toBe(true);
        expect(space.all()).toContain(atom);
    });

    test('removes atoms', () => {
        const atom = sym('A');
        space.add(atom);
        space.remove(atom);
        expect(space.has(atom)).toBe(false);
    });

    test('handles duplicate adds', () => {
        const atom = sym('A');
        space.add(atom);
        space.add(atom);
        expect(space.size()).toBe(1);
    });

    test('indexes rules', () => {
        space.addRule(exp('=', [sym('A'), sym('B')]), sym('B'));
        expect(space.getStats().ruleCount).toBe(1);
        expect(space.getStats().indexedFunctors).toBe(1);
    });

    test('retrieves rules by functor', () => {
        const p1 = exp('+', [v('x'), v('y')]), r1 = sym('res');
        const p2 = exp('-', [v('x'), v('y')]), r2 = sym('res');

        space.addRule(p1, r1);
        space.addRule(p1, r1); // Duplicate op
        space.addRule(p2, r2);

        expect(space.rulesFor('+')).toHaveLength(2);
        expect(space.rulesFor('-')).toHaveLength(1);
        expect(space.rulesFor('unknown')).toHaveLength(0);
    });

    test('fibonacci rules scenario', () => {
        space.addRule(exp('fib', [sym('0')]), sym('0'));
        space.addRule(exp('fib', [sym('1')]), sym('1'));
        space.addRule(exp('fib', [v('n')]), sym('recurse'));

        expect(space.rulesFor('fib')).toHaveLength(3);
    });

    test('mixed atoms and rules', () => {
        space.add(sym('Fact'));
        space.addRule(exp('rule', [v('x')]), sym('res'));
        expect(space.size()).toBe(1);
        expect(space.getRules()).toHaveLength(1);
    });
});
