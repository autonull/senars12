import { describe, it, expect } from 'vitest';
import { termParser } from './parser.js';
import { TermFactory } from './factory.js';

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
      expect(term.args[0]).toBeDefined();
      expect((term.args[0] as any).symbol).toBe('$x');
    });

    it('parses multiple variables', () => {
      const term = termParser.parse('($x --> $y)');
      expect(term.kind).toBe('inheritance');
      expect((term.args[0] as any).symbol).toBe('$x');
      expect((term.args[1] as any).symbol).toBe('$y');
    });
  });

  describe('Truth Value Parsing', () => {
    it('parses term with truth value %f;c%', () => {
      const result = termParser.parseWithTruth('cat %0.8;0.9%');
      expect(result.term).toBeDefined();
      expect(result.truth).toBeDefined();
      expect(result.truth?.f).toBe(0.8);
      expect(result.truth?.c).toBe(0.9);
    });

    it('parses term without truth value', () => {
      const result = termParser.parseWithTruth('cat');
      expect(result.term).toBeDefined();
      expect(result.truth).toBeUndefined();
    });

    it('parses inheritance with truth', () => {
      const result = termParser.parseWithTruth('(cat --> animal) %0.7;0.85%');
      expect(result.term.kind).toBe('inheritance');
      expect(result.truth?.f).toBe(0.7);
      expect(result.truth?.c).toBe(0.85);
    });

    it('parses negation with truth', () => {
      const result = termParser.parseWithThreshold('(--cat) %1.0;0.5%');
      expect(result.term.kind).toBe('negation');
      expect(result.truth?.f).toBe(1.0);
      expect(result.truth?.c).toBe(0.5);
    });
  });

  describe('Negation Syntax', () => {
    it('parses negation with -- operator', () => {
      const term = termParser.parse('(--cat)');
      expect(term.kind).toBe('negation');
    });

    it('parses nested negation', () => {
      const term = termParser.parse('(--(--cat))');
      expect(term.kind).toBe('negation');
      expect(term.args[0]).toBeDefined();
      expect(term.args[0]!.kind).toBe('negation');
    });
  });

  describe('Backward Compatibility', () => {
    it('still parses atoms', () => {
      const term = termParser.parse('cat');
      expect(term.kind).toBe('atom');
      expect(term.symbol).toBe('cat');
    });

    it('still parses inheritance', () => {
      const term = termParser.parse('(cat --> animal)');
      expect(term.kind).toBe('inheritance');
    });

    it('still parses conjunction', () => {
      const term = termParser.parse('(cat & dog)');
      expect(term.kind).toBe('conjunction');
    });
  });
});
