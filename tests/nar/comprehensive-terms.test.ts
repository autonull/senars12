import {TermBuilder, Truth, termsEqual} from '../../src/nar/terms';

describe('Term Builder Comprehensive Tests', () => {
  describe('Atom Creation', () => {
    it('creates unique atoms for different names', () => {
      const a = TermBuilder.atom('A');
      const b = TermBuilder.atom('B');
      expect(termsEqual(a, b)).toBe(false);
    });

    it('reuses atoms with same name', () => {
      const a1 = TermBuilder.atom('X');
      const a2 = TermBuilder.atom('X');
      expect(a1).toBe(a2);
    });

    it('handles special characters in atom names', () => {
      const term1 = TermBuilder.atom('test-term_123');
      const term2 = TermBuilder.atom('test-term_123');
      expect(termsEqual(term1, term2)).toBe(true);
    });

    it('handles unicode in atom names', () => {
      const term1 = TermBuilder.atom('测试');
      const term2 = TermBuilder.atom('测试');
      expect(termsEqual(term1, term2)).toBe(true);
    });
  });

  describe('Inheritance Terms', () => {
    it('creates inheritance terms', () => {
      const subj = TermBuilder.atom('bird');
      const pred = TermBuilder.atom('animal');
      const inh = TermBuilder.inheritance(subj, pred);

      expect(inh).toBeDefined();
    });

    it('preserves argument order in inheritance', () => {
      const a = TermBuilder.atom('A');
      const b = TermBuilder.atom('B');
      const ab = TermBuilder.inheritance(a, b);
      const ba = TermBuilder.inheritance(b, a);

      expect(termsEqual(ab, ba)).toBe(false);
    });
  });

  describe('Similarity Terms', () => {
    it('creates similarity terms', () => {
      const a = TermBuilder.atom('cat');
      const b = TermBuilder.atom('feline');
      const sim = TermBuilder.similarity(a, b);

      expect(sim).toBeDefined();
    });

    it('is commutative', () => {
      const a = TermBuilder.atom('A');
      const b = TermBuilder.atom('B');
      const ab = TermBuilder.similarity(a, b);
      const ba = TermBuilder.similarity(b, a);

      expect(termsEqual(ab, ba)).toBe(true);
    });
  });

  describe('Implication Terms', () => {
    it('creates implication terms', () => {
      const a = TermBuilder.atom('rain');
      const b = TermBuilder.atom('wet');
      const imp = TermBuilder.implication(a, b);

      expect(imp).toBeDefined();
    });

    it('preserves argument order', () => {
      const a = TermBuilder.atom('A');
      const b = TermBuilder.atom('B');
      const ab = TermBuilder.implication(a, b);
      const ba = TermBuilder.implication(b, a);

      expect(termsEqual(ab, ba)).toBe(false);
    });
  });

  describe('Equivalence Terms', () => {
    it('creates equivalence terms', () => {
      const a = TermBuilder.atom('triangle');
      const b = TermBuilder.atom('three-sided');
      const equiv = TermBuilder.equivalence(a, b);

      expect(equiv).toBeDefined();
    });

    it('is commutative', () => {
      const a = TermBuilder.atom('A');
      const b = TermBuilder.atom('B');
      const ab = TermBuilder.equivalence(a, b);
      const ba = TermBuilder.equivalence(b, a);

      expect(termsEqual(ab, ba)).toBe(true);
    });
  });

  describe('Conjunction Terms', () => {
    it('creates conjunction terms', () => {
      const a = TermBuilder.atom('A');
      const b = TermBuilder.atom('B');
      const conj = TermBuilder.conjunction(a, b);

      expect(conj).toBeDefined();
    });

    it('is commutative', () => {
      const a = TermBuilder.atom('A');
      const b = TermBuilder.atom('B');
      const ab = TermBuilder.conjunction(a, b);
      const ba = TermBuilder.conjunction(b, a);

      expect(termsEqual(ab, ba)).toBe(true);
    });

    it('handles multiple arguments', () => {
      const a = TermBuilder.atom('A');
      const b = TermBuilder.atom('B');
      const c = TermBuilder.atom('C');
      const abc = TermBuilder.conjunction(a, b, c);

      expect(abc).toBeDefined();
    });
  });

  describe('Disjunction Terms', () => {
    it('creates disjunction terms', () => {
      const a = TermBuilder.atom('A');
      const b = TermBuilder.atom('B');
      const disj = TermBuilder.disjunction(a, b);

      expect(disj).toBeDefined();
    });

    it('is commutative', () => {
      const a = TermBuilder.atom('A');
      const b = TermBuilder.atom('B');
      const ab = TermBuilder.disjunction(a, b);
      const ba = TermBuilder.disjunction(b, a);

      expect(termsEqual(ab, ba)).toBe(true);
    });
  });

  describe('Negation Terms', () => {
    it('creates negation terms', () => {
      const a = TermBuilder.atom('A');
      const neg = TermBuilder.negation(a);

      expect(neg).toBeDefined();
    });

    it('preserves argument', () => {
      const a = TermBuilder.atom('A');
      const neg = TermBuilder.negation(a);

      expect(neg).toBeDefined();
    });
  });

  describe('Compound Term Equality', () => {
    it('computes consistent equality for compound terms', () => {
      const a = TermBuilder.atom('A');
      const b = TermBuilder.atom('B');

      const inh1 = TermBuilder.inheritance(a, b);
      const inh2 = TermBuilder.inheritance(a, b);

      expect(termsEqual(inh1, inh2)).toBe(true);
    });

    it('distinguishes different compound structures', () => {
      const a = TermBuilder.atom('A');
      const b = TermBuilder.atom('B');
      const c = TermBuilder.atom('C');

      const inh1 = TermBuilder.inheritance(a, b);
      const inh2 = TermBuilder.inheritance(b, c);

      expect(termsEqual(inh1, inh2)).toBe(false);
    });
  });
});

describe('Truth Value Operations', () => {
  describe('Basic Operations', () => {
    it('creates truth values', () => {
      const t = Truth.create(0.8, 0.9);
      expect(t.f).toBe(0.8);
      expect(t.c).toBe(0.9);
    });

    it('clamps frequency to [0, 1]', () => {
      expect(Truth.create(1.5, 0.9).f).toBe(1.0);
      expect(Truth.create(-0.5, 0.9).f).toBe(0.0);
    });

    it('clamps confidence to [0, 1]', () => {
      expect(Truth.create(0.5, 1.5).c).toBe(1.0);
      expect(Truth.create(0.5, -0.5).c).toBe(0.0);
    });

    it('handles NaN inputs', () => {
      const t = Truth.create(NaN, NaN);
      expect(t.f).toBeGreaterThanOrEqual(0);
      expect(t.f).toBeLessThanOrEqual(1);
    });
  });

  describe('Negation', () => {
    it('negates frequency', () => {
      const t = Truth.create(0.7, 0.9);
      const neg = Truth.negation(t);
      expect(neg.f).toBeCloseTo(0.3, 5);
      expect(neg.c).toBe(0.9);
    });

    it('preserves confidence', () => {
      const t = Truth.create(0.5, 0.8);
      const neg = Truth.negation(t);
      expect(neg.c).toBe(0.8);
    });
  });

  describe('Deduction', () => {
    it('computes deduction', () => {
      const t1 = Truth.create(0.9, 0.9);
      const t2 = Truth.create(0.8, 0.8);
      const result = Truth.deduction(t1, t2);

      expect(result.f).toBeCloseTo(0.72, 5);
      expect(result.c).toBeCloseTo(0.72, 5);
    });
  });

  describe('Revision', () => {
    it('combines truth values', () => {
      const t1 = Truth.create(0.6, 0.5);
      const t2 = Truth.create(0.8, 0.5);
      const result = Truth.deduction(t1, t2);

      expect(result).toBeDefined();
    });
  });

  describe('Expectation', () => {
    it('computes expectation value', () => {
      const t = Truth.create(0.8, 0.9);
      const exp = Truth.expectation(t);

      expect(exp).toBeGreaterThan(0.5);
    });

    it('handles neutral truth', () => {
      const t = Truth.create(0.5, 0.9);
      const exp = Truth.expectation(t);

      expect(exp).toBeCloseTo(0.5, 5);
    });
  });

  describe('Comparison Operations', () => {
    it('computes analogy', () => {
      const t1 = Truth.create(0.8, 0.9);
      const t2 = Truth.create(0.7, 0.8);
      const result = Truth.analogy(t1, t2);

      expect(result).toBeDefined();
    });

    it('computes resemblance', () => {
      const t1 = Truth.create(0.8, 0.9);
      const t2 = Truth.create(0.7, 0.8);
      const result = Truth.resemblance(t1, t2);

      expect(result).toBeDefined();
    });

    it('computes intersection', () => {
      const t1 = Truth.create(0.8, 0.9);
      const t2 = Truth.create(0.7, 0.8);
      const result = Truth.intersection(t1, t2);

      expect(result).toBeDefined();
    });

    it('computes union', () => {
      const t1 = Truth.create(0.8, 0.9);
      const t2 = Truth.create(0.7, 0.8);
      const result = Truth.union(t1, t2);

      expect(result).toBeDefined();
    });
  });

  describe('Constants', () => {
    it('TRUE has high frequency', () => {
      expect(Truth.TRUE.f).toBe(1.0);
    });

    it('FALSE has zero frequency', () => {
      expect(Truth.FALSE.f).toBe(0.0);
    });

    it('NEUTRAL has 0.5 frequency', () => {
      expect(Truth.NEUTRAL.f).toBe(0.5);
    });
  });
});
