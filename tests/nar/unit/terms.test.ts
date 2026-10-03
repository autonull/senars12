import type { Term } from '../../../nar/src';
import {
  atomicSymbols,
  bareInheritancePair,
  containsSubterm,
  foldTerm,
  isAtomic,
  isCompound,
  mentionsSymbol,
  sharesInheritanceEnd,
  TermBuilder,
  Truth,
  termDepth,
  termSize,
  walkTerms,
} from '../../../nar/src';
import { fromNarsese, termKey, toNarsese } from '../../../nar/src/terms';

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
    test('undefined input throws — negation requires exactly 1 argument', () => {
      expect(() => TermBuilder.negation(undefined!)).toThrow('exactly 1 argument');
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

  describe('interning', () => {
    /** Interning is what makes structurally equal terms the same object, so the key
     *  has to be injective over every legal symbol — including the ones the grammar
     *  admits as variables and quoted atoms. */
    test.each(['?', '$', '#', '*', '%'])(
      'a %s-variable symbol does not alias across arity',
      (prefix) => {
        const joined = TermBuilder.conjunction(
          TermBuilder.atom(`${prefix}a,b`),
          TermBuilder.atom('c')
        );
        const split = TermBuilder.conjunction(
          TermBuilder.atom(`${prefix}a`),
          TermBuilder.atom('b'),
          TermBuilder.atom('c')
        );

        expect(joined).not.toBe(split);
        expect(termKey(joined)).not.toBe(termKey(split));
      }
    );

    // TODO29.a §5.12: the nested spelling and the flat one are the same claim, so
    // they intern to one term. What keeps that safe is that the canonical form
    // still reads back at the arity it prints — which is the aliasing the old
    // nesting test was actually about.
    test('nesting is one claim with the flat form, and that form still round-trips', () => {
      const nested = TermBuilder.conjunction(
        TermBuilder.conjunction(TermBuilder.atom('a'), TermBuilder.atom('b')),
        TermBuilder.atom('c')
      );
      const flat = TermBuilder.conjunction(
        TermBuilder.atom('a'),
        TermBuilder.atom('b'),
        TermBuilder.atom('c')
      );

      expect(nested).toBe(flat);
      expect(termDepth(nested)).toBe(1);
      expect(fromNarsese(toNarsese(nested))).toBe(flat);
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

  describe('normalize', () => {
    test.each`
      frequency      | confidence     | expectedF | expectedC
      ${1.5}         | ${0.95}        | ${1.0}    | ${0.95}
      ${-0.5}        | ${-0.1}        | ${0.0}    | ${0.0}
      ${0.9}         | ${1.0}         | ${0.9}    | ${Truth.MAX_CONFIDENCE}
      ${0.9}         | ${1.5}         | ${0.9}    | ${Truth.MAX_CONFIDENCE}
      ${Number.NaN}  | ${Number.NaN}  | ${0.5}    | ${0.9}
    `(
      'brings an out-of-domain value into the domain',
      ({ frequency, confidence, expectedF, expectedC }) => {
        const t = Truth.normalize(frequency, confidence);
        expect(t.f).toBe(expectedF);
        expect(t.c).toBe(expectedC);
      }
    );

    // The reason the two exist. Every boundary that reads a number off a wire,
    // a schema or a model reply clamps to `0..1` and stops — and `1` is past
    // the ceiling, so `Truth.create` threw mid-feedback-turn on a value the
    // caller had already done its best with.
    test('a confidence a boundary could legitimately produce is absorbed, not thrown on', () => {
      expect(() => Truth.create(0.9, 1.0)).toThrow('Confidence');
      expect(Truth.normalize(0.9, 1.0).c).toBe(Truth.MAX_CONFIDENCE);
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

  describe('attention', () => {
    test('is exactly f * c', () => {
      for (const [f, c] of [
        [0.5, 0.9],
        [0.01, 0.999],
        [1, 0.5],
        [0, 0.9],
      ] as const)
        expect(Truth.attention(Truth.create(f, c))).toBeCloseTo(f * c, 12);
    });

    test('is not expectation, and the difference is load-bearing', () => {
      // Same salience, different epistemic content: one is "I know nothing",
      // the other leans false. expectation separates them; attention does not.
      const knowsNothing = Truth.create(0.5, 0.8);
      const leansFalse = Truth.create(0.8, 0.5);

      expect(Truth.attention(knowsNothing)).toBeCloseTo(Truth.attention(leansFalse), 12);
      expect(Truth.expectation(knowsNothing)).not.toBeCloseTo(Truth.expectation(leansFalse), 6);
    });

    test('ranks a confidently-false belief above a weakly-true one', () => {
      const certainFalse = Truth.create(0.0, 0.95);
      const slightlyTrue = Truth.create(0.6, 0.2);

      expect(Truth.attention(certainFalse)).toBe(0);
      expect(Truth.attention(slightlyTrue)).toBeCloseTo(0.12, 12);
      expect(Truth.expectation(certainFalse)).toBeLessThan(Truth.expectation(slightlyTrue));
    });
  });

  describe('outcome nudges', () => {
    test('reinforce raises frequency and confidence', () => {
      const t = Truth.create(0.5, 0.6);
      const r = Truth.reinforce(t);

      expect(r.f).toBeCloseTo(0.55, 10);
      expect(r.c).toBeCloseTo(0.7, 10);
    });

    test('contradict lowers frequency and raises confidence', () => {
      const t = Truth.create(0.5, 0.6);
      const r = Truth.contradict(t);

      expect(r.f).toBeCloseTo(0.45, 10);
      expect(r.c).toBeCloseTo(0.7, 10);
    });

    // A 0.9-confidence belief is the default everywhere. Written inline, the
    // `+ 0.1` step produced a confidence of exactly 1, past the ceiling.
    test.each([
      ['reinforce', (t: Truth) => Truth.reinforce(t)],
      ['contradict', (t: Truth) => Truth.contradict(t)],
    ])('%s saturates instead of throwing at the confidence ceiling', (_name, nudge) => {
      const atDefault = nudge(Truth.create(0.9, 0.9));
      expect(atDefault.c).toBe(Truth.MAX_CONFIDENCE);

      const atCeiling = nudge(Truth.create(0.9, Truth.MAX_CONFIDENCE));
      expect(atCeiling.c).toBe(Truth.MAX_CONFIDENCE);
    });

    test('frequency stays in range at the boundaries', () => {
      expect(Truth.reinforce(Truth.create(1, 0.5)).f).toBe(1);
      expect(Truth.contradict(Truth.create(0, 0.5)).f).toBe(0);
    });
  });

  describe('damp', () => {
    test('scales confidence and leaves frequency alone', () => {
      const t = Truth.create(0.7, 0.8);
      const d = Truth.damp(t, 0.5);

      expect(d.f).toBe(t.f);
      expect(d.c).toBeCloseTo(0.4, 10);
    });

    test('does not exceed the confidence ceiling for amplifying factors', () => {
      expect(Truth.damp(Truth.create(0.7, Truth.MAX_CONFIDENCE), 2).c).toBe(Truth.MAX_CONFIDENCE);
    });

    test('differs from the NAL weakening rule', () => {
      const t = Truth.create(0.7, 0.8);
      expect(Truth.damp(t, 0.5).c).not.toBeCloseTo(Truth.weak(t.c), 6);
    });
  });
});

describe('walkTerms', () => {
  const tree = () =>
    TermBuilder.compound('conjunction', [
      TermBuilder.inheritance(TermBuilder.atom('bird'), TermBuilder.atom('animal'))!,
      TermBuilder.atom('flies'),
    ]);

  test('visits pre-order by default with depth from the root', () => {
    const seen: [string, number][] = [];
    walkTerms(tree(), (t, depth) => void seen.push([String(t), depth]));
    expect(seen[0]).toEqual([String(tree()), 0]);
    expect(seen[1]?.[1]).toBe(1);
    expect(seen).toHaveLength(5);
  });

  test('visits post-order on request', () => {
    const seen: string[] = [];
    walkTerms(tree(), (t) => void seen.push(String(t)), 'post-order');
    expect(seen.at(-1)).toBe(String(tree()));
    expect(seen).toHaveLength(5);
  });

  test('prunes descendants when the visitor returns false', () => {
    const seen: string[] = [];
    walkTerms(tree(), (t) => {
      seen.push(String(t));
      return t.kind !== 'inheritance';
    });
    expect(seen.map(String)).toEqual([String(tree()), 'flies', '(bird-->animal)']);
  });
});

describe('term metrics', () => {
  const tree = () =>
    TermBuilder.compound('conjunction', [
      TermBuilder.inheritance(TermBuilder.atom('bird'), TermBuilder.atom('animal'))!,
      TermBuilder.atom('flies'),
    ]);

  test('termDepth counts nesting below the root', () => {
    expect(termDepth(TermBuilder.atom('bird'))).toBe(0);
    expect(termDepth(tree())).toBe(2);
  });

  test('termSize counts every node including the root', () => {
    expect(termSize(TermBuilder.atom('bird'))).toBe(1);
    expect(termSize(tree())).toBe(5);
  });

  test('foldTerm accumulates in visit order', () => {
    expect(foldTerm<number>(tree(), (n, t) => n + (isAtomic(t) ? 1 : 0), 0)).toBe(3);
  });

  test('containsSubterm matches structurally, at any depth', () => {
    const t = tree();
    expect(containsSubterm(t, TermBuilder.atom('animal'))).toBe(true);
    expect(containsSubterm(t, TermBuilder.atom('bird'))).toBe(true);
    expect(containsSubterm(t, TermBuilder.atom('fish'))).toBe(false);
  });

  test('mentionsSymbol and atomicSymbols read the same bag', () => {
    const t = tree();
    expect(mentionsSymbol(t, 'flies')).toBe(true);
    expect(mentionsSymbol(t, 'swims')).toBe(false);
    expect([...atomicSymbols(t)].sort()).toEqual(['animal', 'bird', 'flies']);
  });

  describe('bare inheritance pair', () => {
    const inheritance = (subj: string, pred: string) =>
      TermBuilder.inheritance(TermBuilder.atom(subj), TermBuilder.atom(pred))!;
    const tuple = (...args: Term[]) => TermBuilder.product(...args);

    test('reads the pair off the term itself', () => {
      expect(bareInheritancePair(inheritance('bird', 'animal'))).toEqual({
        subject: 'bird',
        predicate: 'animal',
      });
    });

    test('finds the pair a compound mentions', () => {
      expect(
        bareInheritancePair(tuple(TermBuilder.atom('flies'), inheritance('bird', 'animal')))
      ).toEqual({ subject: 'bird', predicate: 'animal' });
    });

    test('skips an inheritance whose ends are not both atoms, and reports the inner one', () => {
      const outer = TermBuilder.inheritance(
        TermBuilder.atom('bird'),
        inheritance('animal', 'thing')
      )!;
      expect(bareInheritancePair(outer)).toEqual({ subject: 'animal', predicate: 'thing' });
    });

    test('reports no pair for a term that mentions no bare inheritance', () => {
      expect(
        bareInheritancePair(tuple(TermBuilder.atom('bird'), TermBuilder.atom('animal')))
      ).toBeNull();
      expect(bareInheritancePair(TermBuilder.atom('bird'))).toBeNull();
    });

    test('sharesInheritanceEnd is true for a shared subject or predicate, false otherwise', () => {
      const bird = inheritance('bird', 'animal');
      expect(sharesInheritanceEnd(bird, inheritance('bird', 'flies'))).toBe(true);
      expect(sharesInheritanceEnd(bird, inheritance('fish', 'animal'))).toBe(true);
      expect(sharesInheritanceEnd(bird, inheritance('fish', 'swims'))).toBe(false);
      expect(sharesInheritanceEnd(bird, tuple(TermBuilder.atom('bird')))).toBe(false);
    });
  });
});

/**
 * Commutativity is a property of the operator, not a formatting choice: a
 * commutative kind has its arguments sorted at construction, so declaring a kind
 * commutative merges terms that are not equal. `product` was declared so, and
 * `docs/java/Op.java:110` builds `PROD` through the non-commutative constructor.
 */
describe('operator commutativity', () => {
  const product = (...symbols: string[]) =>
    TermBuilder.compound('product', symbols.map((symbol) => TermBuilder.atom(symbol)!));

  test('product order is preserved, so two products are two terms', () => {
    expect(product('bird', 'cat').toString()).toBe('(bird,cat)');
    expect(product('cat', 'bird').toString()).toBe('(cat,bird)');
    expect(product('bird', 'cat')).not.toBe(product('cat', 'bird'));
  });

  test('conjunction order is not: it is commutative, and sorted at construction', () => {
    const bird = TermBuilder.atom('bird')!;
    const cat = TermBuilder.atom('cat')!;
    expect(TermBuilder.conjunction(bird, cat)).toBe(TermBuilder.conjunction(cat, bird));
  });
});

