import {termParser} from './parser.js';

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
            const term = termParser.parse('((bird --> animal) => (flies --> action))');
            expect(term.kind).toBe('implication');
        });
    });
});
