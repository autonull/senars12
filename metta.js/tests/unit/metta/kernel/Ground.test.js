import {Ground} from '@senars/metta/src/kernel/Ground.js';
import {Term} from '@senars/metta/src/kernel/Term.js';

describe('Kernel Ground', () => {
    let ground;

    beforeEach(() => {
        Term.clearSymbolTable();
        ground = new Ground();
    });

    describe('Registration and execution', () => {
        test('registers custom operations', () => {
            ground.register('&custom', (x) => Term.sym(`custom-${x.name}`));

            expect(ground.has('&custom')).toBe(true);
            const result = ground.execute('&custom', Term.sym('test'));
            expect(result.name).toBe('custom-test');
        });

        test('normalizes operation names with & prefix', () => {
            ground.register('myop', () => Term.sym('result'));

            expect(ground.has('myop')).toBe(true);
            expect(ground.has('&myop')).toBe(true);

            const result = ground.execute('myop');
            expect(result.name).toBe('result');
        });

        test('throws on executing unknown operation', () => {
            expect(() => ground.execute('&unknown')).toThrow(/not found/);
        });

        test('lists all registered operations', () => {
            ground.register('&op1', () => Term.sym('1'));
            ground.register('&op2', () => Term.sym('2'));

            const list = ground.list();
            expect(list.length).toBeGreaterThan(2); // Includes builtins
            expect(list).toContain('&op1');
            expect(list).toContain('&op2');
        });

        test('clear removes all operations', () => {
            ground.clear();
            expect(ground.list().length).toBe(0);
            expect(ground.has('&+')).toBe(false);
        });
    });

    describe('Arithmetic operations', () => {
        test('&+ addition', () => {
            const result = ground.execute('&+', Term.sym('2'), Term.sym('3'));
            expect(result.name).toBe('5');
        });

        test('&+ with multiple arguments', () => {
            const result = ground.execute('&+', Term.sym('1'), Term.sym('2'), Term.sym('3'));
            expect(result.name).toBe('6');
        });

        test('&- subtraction', () => {
            const result = ground.execute('&-', Term.sym('10'), Term.sym('3'));
            expect(result.name).toBe('7');
        });

        test('&- negation (single argument)', () => {
            const result = ground.execute('&-', Term.sym('5'));
            expect(result.name).toBe('-5');
        });

        test('&* multiplication', () => {
            const result = ground.execute('&*', Term.sym('4'), Term.sym('5'));
            expect(result.name).toBe('20');
        });

        test('&* with multiple arguments', () => {
            const result = ground.execute('&*', Term.sym('2'), Term.sym('3'), Term.sym('4'));
            expect(result.name).toBe('24');
        });

        test('&/ division', () => {
            const result = ground.execute('&/', Term.sym('10'), Term.sym('2'));
            expect(result.name).toBe('5');
        });

        test('&/ returns Error on division by zero', () => {
            const result = ground.execute('&/', Term.sym('10'), Term.sym('0'));
            expect(result.operator.name).toBe('Error');
            expect(result.components[1].name).toBe('Division by zero');
        });

        test('handles decimal numbers', () => {
            const result = ground.execute('&+', Term.sym('1.5'), Term.sym('2.5'));
            expect(result.name).toBe('4');
        });

        test('returns Error on non-numeric input', () => {
            const result = ground.execute('&+', Term.sym('foo'), Term.sym('bar'));
            expect(result.operator.name).toBe('Error');
            expect(result.components[1].name).toBe('Expected numbers');
        });
    });

    describe('Comparison operations', () => {
        test('&< less than', () => {
            const result1 = ground.execute('&<', Term.sym('5'), Term.sym('10'));
            const result2 = ground.execute('&<', Term.sym('10'), Term.sym('5'));

            expect(result1.name).toBe('True');
            expect(result2.name).toBe('False');
        });

        test('&> greater than', () => {
            const result1 = ground.execute('&>', Term.sym('10'), Term.sym('5'));
            const result2 = ground.execute('&>', Term.sym('5'), Term.sym('10'));

            expect(result1.name).toBe('True');
            expect(result2.name).toBe('False');
        });

        test('&== equality', () => {
            const result1 = ground.execute('&==', Term.sym('foo'), Term.sym('foo'));
            const result2 = ground.execute('&==', Term.sym('foo'), Term.sym('bar'));

            expect(result1.name).toBe('True');
            expect(result2.name).toBe('False');
        });

        test('&== works with numbers', () => {
            const result = ground.execute('&==', Term.sym('42'), Term.sym('42'));
            expect(result.name).toBe('True');
        });
    });

    describe('Logical operations', () => {
        test('&and all true', () => {
            const result = ground.execute('&and', Term.sym('True'), Term.sym('True'));
            expect(result.name).toBe('True');
        });

        test('&and with false', () => {
            const result = ground.execute('&and', Term.sym('True'), Term.sym('False'));
            expect(result.name).toBe('False');
        });

        test('&and with multiple arguments', () => {
            const result1 = ground.execute('&and', Term.sym('True'), Term.sym('True'), Term.sym('True'));
            const result2 = ground.execute('&and', Term.sym('True'), Term.sym('False'), Term.sym('True'));

            expect(result1.name).toBe('True');
            expect(result2.name).toBe('False');
        });

        test('&or any true', () => {
            const result = ground.execute('&or', Term.sym('False'), Term.sym('True'));
            expect(result.name).toBe('True');
        });

        test('&or all false', () => {
            const result = ground.execute('&or', Term.sym('False'), Term.sym('False'));
            expect(result.name).toBe('False');
        });

        test('&not negation', () => {
            const result1 = ground.execute('&not', Term.sym('True'));
            const result2 = ground.execute('&not', Term.sym('False'));

            expect(result1.name).toBe('False');
            expect(result2.name).toBe('True');
        });
    });

    describe('I/O operations', () => {
        test('&print outputs to console', () => {
            // Mock console.log manually since jest global is not available
            const originalLog = console.log;
            let logOutput = '';
            console.log = (msg) => {
                logOutput = msg;
            };

            try {
                const result = ground.execute('&print', Term.sym('Hello'), Term.sym('World'));

                expect(logOutput).toBe('Hello World');
                expect(result.name).toBe('Null');
            } finally {
                console.log = originalLog;
            }
        });

        test('&now returns timestamp', () => {
            const before = Date.now();
            const result = ground.execute('&now');
            const after = Date.now();

            const timestamp = Number(result.name);
            expect(timestamp).toBeGreaterThanOrEqual(before);
            expect(timestamp).toBeLessThanOrEqual(after);
        });
    });

    describe('Integration scenarios', () => {
        test('complex arithmetic expression', () => {
            // Calculate: (2 + 3) * 4
            const sum = ground.execute('&+', Term.sym('2'), Term.sym('3'));
            expect(sum.name).toBe('5');

            const product = ground.execute('&*', sum, Term.sym('4'));
            expect(product.name).toBe('20');
        });

        test('conditional logic', () => {
            const cmp = ground.execute('&>', Term.sym('10'), Term.sym('5'));
            expect(cmp.name).toBe('True');

            const and_result = ground.execute('&and', cmp, Term.sym('True'));
            expect(and_result.name).toBe('True');
        });

        test('chained operations', () => {
            // ((10 - 2) / 2) + 1
            const sub = ground.execute('&-', Term.sym('10'), Term.sym('2'));
            const div = ground.execute('&/', sub, Term.sym('2'));
            const add = ground.execute('&+', div, Term.sym('1'));

            expect(add.name).toBe('5');
        });
    });
});
