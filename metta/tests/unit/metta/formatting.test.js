import {MeTTaInterpreter, Term} from '../../../metta/src/index.js';
import {Formatter} from '../../../metta/src/kernel/Formatter.js';

describe('Output Formatting Parity', () => {
    let interpreter;

    beforeEach(() => {
        interpreter = new MeTTaInterpreter();
    });

    test('Formatter.toHyperonString formats lists correctly', () => {
        // (: A (: B ())) -> (A B)
        const list = Term.exp(Term.sym(':'), [
            Term.sym('A'),
            Term.exp(Term.sym(':'), [Term.sym('B'), Term.sym('()')])
        ]);
        expect(Formatter.toHyperonString(list)).toBe('(A B)');
    });

    test('Formatter.toHyperonString formats nested lists correctly', () => {
        // (: (: A ()) (: B ())) -> ((A) B)
        const innerA = Term.exp(Term.sym(':'), [Term.sym('A'), Term.sym('()')]);
        const list = Term.exp(Term.sym(':'), [
            innerA,
            Term.exp(Term.sym(':'), [Term.sym('B'), Term.sym('()')])
        ]);
        expect(Formatter.toHyperonString(list)).toBe('((A) B)');
    });

    test('interpreter.run returns multiple results for superpose', () => {
        const result = interpreter.run('!(superpose (A B))');
        expect(Array.isArray(result)).toBe(true);
        expect(result.length).toBe(2);
        // Check formatted output of the results array
        expect(result.toString()).toBe('[A, B]');
    });

    test('&println uses Formatter', () => {
        const originalLog = console.log;
        let logged = '';
        console.log = (msg) => {
            logged = msg;
        };

        try {
            interpreter.run('!(&println (: Hello (: World ())))');
            expect(logged).toBe('(Hello World)');
        } finally {
            console.log = originalLog;
        }
    });

    test('Strings are printed correctly', () => {
        // Strings are typically Symbols with quotes in name like '"foo"'
        const str = Term.sym('"Hello World"');
        expect(Formatter.toHyperonString(str)).toBe('"Hello World"');
    });
});
