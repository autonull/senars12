import {Ground} from '@senars/metta/src/kernel/Ground.js';
import {exp, isExpression, sym} from '@senars/metta/src/kernel/Term.js';

describe('Ground.js - Expression Operations', () => {
    let ground;

    beforeEach(() => {
        ground = new Ground();
    });

    describe('cons-atom', () => {
        test('constructs expression from head and tail', () => {
            const head = sym('f');
            const tail = exp(sym('a'), [sym('b')]);
            const result = ground.execute('&cons-atom', head, tail);
            expect(isExpression(result)).toBe(true);
            expect(result.operator.name).toBe('f');
        });

        test('handles non-expression tail', () => {
            const head = sym('f');
            const tail = sym('x');
            const result = ground.execute('&cons-atom', head, tail);
            expect(isExpression(result)).toBe(true);
            expect(result.operator.name).toBe('f');
            expect(result.components[0].name).toBe('x');
        });
    });

    describe('decons-atom', () => {
        test('splits expression into head and tail', () => {
            const expr = exp(sym('f'), [sym('a'), sym('b')]);
            const result = ground.execute('&decons-atom', expr);
            expect(isExpression(result)).toBe(true);
            expect(result.operator.name).toBe(':');
        });

        test('returns error for non-expression', () => {
            const atom = sym('x');
            const result = ground.execute('&decons-atom', atom);
            expect(result.operator.name).toBe('Error');
        });
    });

    describe('car-atom', () => {
        test('returns first element (operator)', () => {
            const expr = exp(sym('f'), [sym('a'), sym('b')]);
            const result = ground.execute('&car-atom', expr);
            expect(result.name).toBe('f');
        });

        test('returns error for non-expression', () => {
            const atom = sym('x');
            const result = ground.execute('&car-atom', atom);
            expect(result.operator.name).toBe('Error');
        });
    });

    describe('cdr-atom', () => {
        test('returns tail of expression', () => {
            const expr = exp(sym('f'), [sym('a'), sym('b')]);
            const result = ground.execute('&cdr-atom', expr);
            expect(isExpression(result)).toBe(true);
        });

        test('returns () for expression without components', () => {
            const expr = exp(sym('f'), []);
            const result = ground.execute('&cdr-atom', expr);
            expect(result.name).toBe('()');
        });
    });

    describe('size-atom', () => {
        test('counts elements in expression', () => {
            const expr = exp(sym('f'), [sym('a'), sym('b'), sym('c')]);
            const result = ground.execute('&size-atom', expr);
            expect(result.name).toBe('4'); // operator + 3 components
        });

        test('returns 1 for non-expression', () => {
            const atom = sym('x');
            const result = ground.execute('&size-atom', atom);
            expect(result.name).toBe('1');
        });
    });

    describe('index-atom', () => {
        test('accesses element by index', () => {
            const expr = exp(sym('f'), [sym('a'), sym('b'), sym('c')]);
            const result = ground.execute('&index-atom', expr, sym('0'));
            expect(result.name).toBe('f');
        });

        test('accesses component by index', () => {
            const expr = exp(sym('f'), [sym('a'), sym('b'), sym('c')]);
            const result = ground.execute('&index-atom', expr, sym('2'));
            expect(result.name).toBe('b');
        });

        test('returns error for out of bounds index', () => {
            const expr = exp(sym('f'), [sym('a')]);
            const result = ground.execute('&index-atom', expr, sym('5'));
            expect(result.operator.name).toBe('Error');
        });

        test('returns error for non-numeric index', () => {
            const expr = exp(sym('f'), [sym('a')]);
            const result = ground.execute('&index-atom', expr, sym('foo'));
            expect(result.operator.name).toBe('Error');
        });
    });
});
