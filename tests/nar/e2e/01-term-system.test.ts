/**
 * Term System Tests - Canonicalization, Hashing, and Structural Sharing
 */
import { NAR } from '../../../src';
import { TermBuilder, Truth, termsEqual } from '../../../nar/src';

describe('Term System', () => {
  let nar: NAR; // eslint-disable-line @typescript-eslint/no-unused-vars

  beforeEach(() => {
    nar = new NAR({
      maxConcepts: 100,
      activationDecayRate: 0.01,
      consolidationInterval: 5,
      cpuThrottleMs: 10,
      maxDerivationDepth: 10,
      maxDerivationsPerStep: 100,
      enableLMRules: false,
    });
  });

  describe('Canonicalization', () => {
    it('creates canonical terms with structural sharing', () => {
      const bird1 = TermBuilder.atom('bird');
      const bird2 = TermBuilder.atom('bird');
      expect(bird1).toBe(bird2);
      expect(termsEqual(bird1, bird2)).toBe(true);
    });

    it('normalizes conjunctions for canonical form', () => {
      const a = TermBuilder.atom('A');
      const b = TermBuilder.atom('B');
      const conj1 = TermBuilder.conjunction(a, b);
      const conj2 = TermBuilder.conjunction(b, a);
      expect(termsEqual(conj1, conj2)).toBe(true);
    });

    it('maintains truth value consistency', () => {
      const t1 = Truth.create(0.8, 0.9);
      const t2 = Truth.create(0.8, 0.9);
      expect(t1.f).toBe(t2.f);
      expect(t1.c).toBe(t2.c);
    });
  });

  describe('Compound Terms', () => {
    it('creates inheritance terms', () => {
      const bird = TermBuilder.atom('bird');
      const animal = TermBuilder.atom('animal');
      const inheritance = TermBuilder.inheritance(bird, animal);
      expect(inheritance.kind).toBe('inheritance');
      if ('args' in inheritance) expect(inheritance.args).toHaveLength(2);
    });

    it('creates conjunction terms', () => {
      const a = TermBuilder.atom('A');
      const b = TermBuilder.atom('B');
      const conj = TermBuilder.conjunction(a, b);
      expect(conj.kind).toBe('conjunction');
      if ('args' in conj) expect(conj.args).toHaveLength(2);
    });

    it('creates disjunction terms', () => {
      const a = TermBuilder.atom('A');
      const b = TermBuilder.atom('B');
      const disj = TermBuilder.disjunction(a, b);
      expect(disj.kind).toBe('disjunction');
    });

    it('creates implication terms', () => {
      const a = TermBuilder.atom('A');
      const b = TermBuilder.atom('B');
      const imp = TermBuilder.implication(a, b);
      expect(imp.kind).toBe('implication');
    });
  });
});
