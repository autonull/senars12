import {termParser} from '../../../src/nar';

describe('TermParser', () => {
    describe('Variable Support', () => {
        it('parses variables with $ prefix', () => {
            const term = termParser.parse('$x');
            expect(term.kind).toBe('atom');
            expect((term as any).symbol).toBe('$x');
            expect((term as any).isVariable).toBe(true);
        });

        it('parses variables in inheritance', () => {
            const term = termParser.parse('($x --> animal)');
            expect(term.kind).toBe('inheritance');
            const args = (term as any).args ?? [];
            expect(args[0]).toBeDefined();
            expect(args[0].symbol).toBe('$x');
        });

        it('parses multiple variables', () => {
            const term = termParser.parse('($x --> $y)');
            expect(term.kind).toBe('inheritance');
            const args = (term as any).args ?? [];
            expect(args[0].symbol).toBe('$x');
            expect(args[1].symbol).toBe('$y');
        });
    });

    describe('Truth Value Parsing', () => {
        it('parses term with truth value %f;c%', () => {
            const result = termParser.parseWithTruth('bird %0.8; 0.9%');
            expect(result.term.kind).toBe('atom');
            if ('symbol' in result.term) {
                expect(result.term.symbol).toBe('bird');
            }
            expect(result.truth).toBeDefined();
            expect(result.truth?.f).toBeCloseTo(0.8);
            expect(result.truth?.c).toBeCloseTo(0.9);
        });

        it('parses inheritance with truth value', () => {
            const result = termParser.parseWithTruth('(bird --> animal) %0.9; 0.95%');
            expect(result.term.kind).toBe('inheritance');
            expect(result.truth).toBeDefined();
            expect(result.truth?.f).toBeCloseTo(0.9);
            expect(result.truth?.c).toBeCloseTo(0.95);
        });

        it('defaults truth to undefined when not provided', () => {
            const result = termParser.parseWithTruth('bird');
            expect(result.term.kind).toBe('atom');
            expect(result.truth).toBeUndefined();
        });
    });

    describe('Edge Cases', () => {
        it('handles empty input gracefully', () => {
            expect(() => termParser.parse('')).toThrow();
        });

        it('handles complex nested structures', () => {
            const term = termParser.parse('((bird --> animal) ==> (flies --> action))');
            expect(term.kind).toBe('implication');
        });

        it('handles (a-->b). style input without hanging', () => {
            const result = termParser.parseWithTruth('(a-->b).');
            expect(result.term.kind).toBe('inheritance');
        });

        it('parses sets and properties', () => {
            expect(termParser.parse('{a, b}').kind).toBe('setExt');
            expect(termParser.parse('[a, b]').kind).toBe('setInt');
        });

        it('parses negation', () => {
            expect(termParser.parse('--a').kind).toBe('negation');
        });

        it('parses angle bracket statements', () => {
            expect(termParser.parse('<a --> b>').kind).toBe('inheritance');
        });
    });

    describe('Quoted Atoms (LM-ready)', () => {
        it('parses quoted atom with spaces', () => {
            const term = termParser.parse('"living being"');
            expect(term.kind).toBe('atom');
            expect((term as any).symbol).toBe('"living being"');
        });

        it('parses quoted atom in statement', () => {
            const result = termParser.parse('(animal --> "living being")');
            expect(result.kind).toBe('inheritance');
        });

        it('parses quoted atom with special chars', () => {
            const term = termParser.parse('"needs oxygen"');
            expect(term.kind).toBe('atom');
            expect((term as any).symbol).toBe('"needs oxygen"');
        });

        it('parses long quoted text', () => {
            const term = termParser.parse('"a long sentence with many words"');
            expect(term.kind).toBe('atom');
        });
    });

    describe('REPL-style Punctuation', () => {
        it('strips trailing period from belief', () => {
            const result = termParser.parseWithTruth('(a-->b).');
            expect(result.term.kind).toBe('inheritance');
        });

        it('strips trailing question mark from question', () => {
            const result = termParser.parseWithTruth('(a-->b)?');
            expect(result.term.kind).toBe('inheritance');
        });

        it('strips trailing exclamation from goal', () => {
            const result = termParser.parseWithTruth('(a-->b)!');
            expect(result.term.kind).toBe('inheritance');
        });
    });
});
