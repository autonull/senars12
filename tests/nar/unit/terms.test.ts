import { TermBuilder, Truth, isAtomic, isCompound } from '../../../nar/src';

describe('TermBuilder', () => {
  beforeEach(() => TermBuilder.clear());

  describe('atom', () => {
    test('creates and caches terms', () => {
      const t1 = TermBuilder.atom('bird');
      const t2 = TermBuilder.atom('bird');
      expect(t1).toBe(t2);
    });

    test.each`
      symbol
      ${'TRUE'}
      ${'FALSE'}
      ${'NULL'}
    `('returns singleton for $symbol', ({ symbol }) => {
      const t1 = TermBuilder.atom(symbol);
      const t2 = TermBuilder.atom(symbol);
      expect(t1).toBe(t2);
    });

    test('creates distinct terms for different symbols', () => {
      const terms = ['bird', 'animal', 'mammal', 'dog'];
      const atoms = terms.map((t) => TermBuilder.atom(t));

      // All should be distinct
      for (let i = 0; i < atoms.length; i++) {
        for (let j = i + 1; j < atoms.length; j++) {
          expect(atoms[i]).not.toBe(atoms[j]);
        }
      }
    });
  });

  describe('inheritance', () => {
    test('creates compound term', () => {
      const bird = TermBuilder.atom('bird');
      const animal = TermBuilder.atom('animal');
      const t = TermBuilder.inheritance(bird, animal);

      expect(t).toBeDefined();
      expect(isCompound(t!)).toBe(true);
    });

    test('preserves order of arguments', () => {
      const a = TermBuilder.atom('A');
      const b = TermBuilder.atom('B');

      const t1 = TermBuilder.inheritance(a, b);
      const t2 = TermBuilder.inheritance(b, a);

      expect(t1).not.toBe(t2);
    });
  });

  describe('conjunction', () => {
    test('sorts arguments for canonicalization', () => {
      const a = TermBuilder.atom('A');
      const b = TermBuilder.atom('B');
      const conj1 = TermBuilder.conjunction(a, b);
      const conj2 = TermBuilder.conjunction(b, a);

      expect(conj1).toBe(conj2);
    });

    test('handles multiple arguments', () => {
      const args = [1, 2, 3, 4, 5].map((i) => TermBuilder.atom(`term${i}`));
      const conj = TermBuilder.conjunction(...args);

      expect(isCompound(conj)).toBe(true);
    });
  });

  describe('negation', () => {
    test('handles undefined input', () => {
      const t = TermBuilder.negation(undefined!);
      expect(isAtomic(t)).toBe(true);
    });

    test('creates negation term', () => {
      const term = TermBuilder.atom('test');
      const negated = TermBuilder.negation(term);

      expect(isCompound(negated)).toBe(true);
    });
  });

  describe('compound', () => {
    test('creates compound with custom kind', () => {
      const a = TermBuilder.atom('A');
      const b = TermBuilder.atom('B');
      const t = TermBuilder.compound('implication', [a, b]);

      expect(isCompound(t)).toBe(true);
    });

    test.each`
      kind
      ${'inheritance'}
      ${'similarity'}
      ${'implication'}
      ${'conjunction'}
    `('supports $kind compound type', ({ kind }) => {
      const a = TermBuilder.atom('A');
      const b = TermBuilder.atom('B');
      const t = TermBuilder.compound(kind, [a, b]);

      expect(isCompound(t)).toBe(true);
    });
  });
});

describe('Truth', () => {
  describe('create', () => {
    test.each`
      frequency | confidence | expectedF | expectedC
      ${0.5}    | ${0.9}     | ${0.5}    | ${0.9}
      ${1.5}    | ${0.95}    | ${1.0}    | ${0.95}
      ${-0.5}   | ${-0.1}    | ${0.0}    | ${0.0}
      ${0.0}    | ${0.0}     | ${0.0}    | ${0.0}
      ${1.0}    | ${0.999}   | ${1.0}    | ${0.999}
    `('clamps values to [0,1] range', ({ frequency, confidence, expectedF, expectedC }) => {
      const t = Truth.create(frequency, confidence);
      expect(t.f).toBe(expectedF);
      expect(t.c).toBe(expectedC);
    });

    test('throws on confidence exceeding maximum', () => {
      expect(() => Truth.create(0.9, 1.5)).toThrow('Confidence');
      expect(() => Truth.create(0.9, 1.001)).toThrow('Confidence');
    });

    test('preserves valid values', () => {
      const t = Truth.create(0.7, 0.8);
      expect(t.f).toBe(0.7);
      expect(t.c).toBe(0.8);
    });
  });

  describe('deduction', () => {
    test.each`
      f1     | c1      | f2     | c2      | minF   | minC
      ${0.9} | ${0.9}  | ${0.9} | ${0.9}  | ${0.8} | ${0.8}
      ${0.5} | ${0.7}  | ${0.6} | ${0.8}  | ${0.2} | ${0.3}
      ${1.0} | ${0.99} | ${1.0} | ${0.99} | ${0.9} | ${0.9}
    `('computes deduction with truth values', ({ f1, c1, f2, c2, minF, minC }) => {
      const t1 = Truth.create(f1, c1);
      const t2 = Truth.create(f2, c2);
      const result = Truth.deduction(t1, t2);

      expect(result.f).toBeGreaterThanOrEqual(minF);
      expect(result.c).toBeGreaterThanOrEqual(minC);
      expect(result.f).toBeLessThanOrEqual(1);
      expect(result.c).toBeLessThanOrEqual(1);
    });

    test('produces result with lower or equal truth values', () => {
      const t1 = Truth.create(0.8, 0.9);
      const t2 = Truth.create(0.7, 0.85);
      const result = Truth.deduction(t1, t2);

      expect(result.f).toBeLessThanOrEqual(Math.min(t1.f, t2.f));
      expect(result.c).toBeLessThanOrEqual(Math.min(t1.c, t2.c));
    });
  });

  describe('singleton values', () => {
    test('TRUE is singleton', () => {
      expect(Truth.TRUE.f).toBe(1.0);
      expect(Truth.TRUE.c).toBe(0.9);
      expect(Truth.TRUE).toBe(Truth.TRUE);
    });

    test('NEUTRAL is singleton', () => {
      expect(Truth.NEUTRAL).toBe(Truth.NEUTRAL);
    });
  });

  describe('revision', () => {
    test('revision is commutative', () => {
      const t1 = Truth.create(0.7, 0.8);
      const t2 = Truth.create(0.6, 0.75);

      const r1 = Truth.revision(t1, t2);
      const r2 = Truth.revision(t2, t1);

      expect(Math.abs(r1.f - r2.f)).toBeLessThan(1e-9);
      expect(Math.abs(r1.c - r2.c)).toBeLessThan(1e-9);
    });

    test('combines evidence from multiple sources', () => {
      const t1 = Truth.create(0.8, 0.9);
      const t2 = Truth.create(0.7, 0.85);
      const result = Truth.revision(t1, t2);

      expect(result.f).toBeGreaterThan(Math.min(t1.f, t2.f));
      expect(result.c).toBeGreaterThan(Math.max(t1.c, t2.c));
    });
  });
});
