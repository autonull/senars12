/**
 * Term System Tests - Canonicalization, Hashing, and Structural Sharing
 */
import { NAR } from '../../nar.js';
import { TermFactory } from '../../terms/factory.js';
import { Truth } from '../../terms/truth.js';

describe('Term System', () => {
  let nar: NAR; // eslint-disable-line @typescript-eslint/no-unused-vars

  beforeEach(() => {
    nar = new NAR({
      maxConcepts: 100,
      priorityThreshold: 0.1,
      activationDecayRate: 0.01,
      consolidationInterval: 5,
      cpuThrottleMs: 10,
      maxDerivationDepth: 10,
      maxDerivationsPerStep: 100,
      enableLMRules: false
    });
  });

  describe('Canonicalization', () => {
    it('creates canonical terms with structural sharing', () => {
      const bird1 = TermFactory.atom('bird');
      const bird2 = TermFactory.atom('bird');
      expect(bird1).toBe(bird2);
      expect(bird1.hash).toBe(bird2.hash);
    });

    it('normalizes conjunctions for canonical form', () => {
      const a = TermFactory.atom('A');
      const b = TermFactory.atom('B');
      const conj1 = TermFactory.conjunction(a, b);
      const conj2 = TermFactory.conjunction(b, a);
      expect(conj1.hash).toBe(conj2.hash);
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
      const bird = TermFactory.atom('bird');
      const animal = TermFactory.atom('animal');
      const inheritance = TermFactory.inheritance(bird, animal);
      expect(inheritance.kind).toBe('inheritance');
      if ("args" in inheritance) expect(inheritance.args).toHaveLength(2);
    });

    it('creates conjunction terms', () => {
      const a = TermFactory.atom('A');
      const b = TermFactory.atom('B');
      const conj = TermFactory.conjunction(a, b);
      expect(conj.kind).toBe('conjunction');
      if ("args" in conj) expect(conj.args).toHaveLength(2);
    });

    it('creates disjunction terms', () => {
      const a = TermFactory.atom('A');
      const b = TermFactory.atom('B');
      const disj = TermFactory.disjunction(a, b);
      expect(disj.kind).toBe('disjunction');
    });

    it('creates implication terms', () => {
      const a = TermFactory.atom('A');
      const b = TermFactory.atom('B');
      const imp = TermFactory.implication(a, b);
      expect(imp.kind).toBe('implication');
    });
  });
});
