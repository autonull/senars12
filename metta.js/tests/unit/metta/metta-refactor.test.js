/**
 * Unit tests for refactored MeTTa components
 * Testing the changes made during the cleanup and refactoring process
 */

import {Ground, MeTTaInterpreter, Space, Term} from '../../../metta/src/index.js';
import {TypeSystem} from '../../../metta/src/TypeSystem.js';
import {Parser} from '../../../metta/src/Parser.js';

describe('MeTTa Refactored Components', () => {
    describe('MeTTaInterpreter', () => {
        let interpreter;

        beforeEach(() => {
            interpreter = new MeTTaInterpreter();
        });

        test('should initialize correctly with all components', () => {
            expect(interpreter.space).toBeDefined();
            expect(interpreter.ground).toBeDefined();
            expect(interpreter.parser).toBeDefined();
            expect(interpreter.typeSystem).toBeDefined();
            expect(interpreter.typeChecker).toBeDefined();
        });

        test('should execute basic arithmetic operations', () => {
            const result = interpreter.run('(+ 2 3)');
            expect(result[0].name).toBe('5');
        });

        test('should handle variable bindings', () => {
            const result = interpreter.run('(let $x 5 $x)');
            expect(result[0].name).toBe('5');
        });

        test('should evaluate conditional expressions', () => {
            const result = interpreter.run('(if True 10 20)');
            expect(result[0].name).toBe('10');
        });
    });

    describe('TypeSystem', () => {
        let typeSystem;

        beforeEach(() => {
            typeSystem = new TypeSystem();
        });

        test('should create fresh type variables', () => {
            const tv1 = typeSystem.freshTypeVar();
            const tv2 = typeSystem.freshTypeVar();

            expect(tv1.kind).toBe('TypeVar');
            expect(tv2.kind).toBe('TypeVar');
            expect(tv1.index).toBe(0);
            expect(tv2.index).toBe(1);
        });

        test('should infer types for basic atoms', () => {
            const numType = typeSystem.inferType(Term.sym('42'));
            const boolType = typeSystem.inferType(Term.sym('True'));
            const varType = typeSystem.inferType(Term.var('x'));

            expect(typeSystem.typeToString(numType)).toBe('Number');
            expect(typeSystem.typeToString(boolType)).toBe('Bool');
        });

        test('should unify compatible types', () => {
            const type1 = typeSystem.freshTypeVar();
            const type2 = typeSystem.freshTypeVar();

            // Should be able to unify two fresh type variables
            const unified = typeSystem.unifyTypes(type1, type2);
            expect(unified).toBe(true);
        });
    });

    describe('Term', () => {
        test('should create symbols correctly', () => {
            const sym1 = Term.sym('test');
            const sym2 = Term.sym('test');

            // Should be the same object due to interning
            expect(sym1).toBe(sym2);
            expect(sym1.name).toBe('test');
            expect(sym1.type).toBe('atom');
        });

        test('should create variables correctly', () => {
            const var1 = Term.var('x');
            const var2 = Term.var('x');

            // Should be the same object due to interning
            expect(var1).toBe(var2);
            expect(var1.name).toBe('$x');
        });

        test('should create expressions correctly', () => {
            const expr = Term.exp(Term.sym('+'), [Term.sym('1'), Term.sym('2')]);

            expect(expr.type).toBe('compound');
            expect(expr.operator.name).toBe('+');
            expect(expr.components.length).toBe(2);
            expect(expr.components[0].name).toBe('1');
            expect(expr.components[1].name).toBe('2');
        });

        test('should check if atom is variable correctly', () => {
            const variable = Term.var('x');
            const symbol = Term.sym('x');

            expect(Term.isVar(variable)).toBe(true);
            expect(Term.isVar(symbol)).toBe(false);
        });

        test('should check if atom is expression correctly', () => {
            const expr = Term.exp(Term.sym('+'), [Term.sym('1'), Term.sym('2')]);
            const symbol = Term.sym('x');

            expect(Term.isExpression(expr)).toBe(true);
            expect(Term.isExpression(symbol)).toBe(false);
        });
    });

    describe('Space', () => {
        let space;

        beforeEach(() => {
            space = new Space();
        });

        test('should add and retrieve atoms', () => {
            const atom = Term.sym('test_atom');
            space.add(atom);

            expect(space.has(atom)).toBe(true);
            expect(space.size()).toBe(1);
        });

        test('should remove atoms', () => {
            const atom = Term.sym('test_atom');
            space.add(atom);

            const removed = space.remove(atom);
            expect(removed).toBe(true);
            expect(space.has(atom)).toBe(false);
            expect(space.size()).toBe(0);
        });

        test('should store and retrieve rules', () => {
            const pattern = Term.sym('p');
            const result = Term.sym('r');

            space.addRule(pattern, result);
            const rules = space.getRules();

            expect(rules.length).toBe(1);
            expect(rules[0].pattern).toBe(pattern);
            expect(rules[0].result).toBe(result);
        });
    });

    describe('Ground', () => {
        let ground;

        beforeEach(() => {
            ground = new Ground();
        });

        test('should register and execute operations', () => {
            ground.register('test-op', (x) => Term.sym(`result_${x.name}`));

            expect(ground.has('test-op')).toBe(true);
            const result = ground.execute('test-op', Term.sym('input'));
            expect(result.name).toBe('result_input');
        });

        test('should handle arithmetic operations', () => {
            const result = ground.execute('&+', Term.sym('2'), Term.sym('3'));
            expect(result.name).toBe('5');
        });

        test('should determine if operations are lazy', () => {
            ground.register('lazy-op', () => Term.sym('result'), {lazy: true});
            ground.register('eager-op', () => Term.sym('result'), {lazy: false});

            expect(ground.isLazy('lazy-op')).toBe(true);
            expect(ground.isLazy('eager-op')).toBe(false);
        });
    });

    describe('Parser', () => {
        let parser;

        beforeEach(() => {
            parser = new Parser();
        });

        test('should parse simple symbols', () => {
            const result = parser.parse('hello');
            expect(result.name).toBe('hello');
            expect(result.type).toBe('atom');
        });

        test('should parse variables', () => {
            const result = parser.parse('$x');
            expect(result.name).toBe('$x');
            expect(result.type).toBe('atom');
        });

        test('should parse expressions', () => {
            const result = parser.parse('(+ 1 2)');
            expect(result.type).toBe('compound');
            expect(result.operator.name).toBe('+');
            expect(result.components.length).toBe(2);
            expect(result.components[0].name).toBe('1');
            expect(result.components[1].name).toBe('2');
        });

        test('should parse nested expressions', () => {
            const result = parser.parse('(+ (* 2 3) 5)');
            expect(result.type).toBe('compound');
            expect(result.operator.name).toBe('+');
            expect(result.components.length).toBe(2);

            const nested = result.components[0];
            expect(nested.type).toBe('compound');
            expect(nested.operator.name).toBe('*');
            expect(nested.components[0].name).toBe('2');
            expect(nested.components[1].name).toBe('3');
        });

        test('should parse program with multiple expressions', () => {
            const result = parser.parseProgram('(+ 1 2) (* 3 4)');
            expect(result.length).toBe(2);
            expect(result[0].operator.name).toBe('+');
            expect(result[1].operator.name).toBe('*');
        });
    });
});