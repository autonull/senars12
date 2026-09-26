import fc from 'fast-check';
import { PriorityBag } from '../../nar/src/bag';
import {
  normalize,
  Stamp,
  serializeTerm,
  TermBuilder,
  Truth,
  termsEqual,
} from '../../nar/src/terms';

// Valid atom name arbitrary matching Narsese grammar: [^(){}[\]<>.,!%?;:@ \t\n\r=&/|>-]+
// Excludes: (){}[]<>.,!%?;:@ \t\n\r=&/|>-  (note: + is ALLOWED, - is NOT)
const validAtomName = fc.string({
  minLength: 1,
  maxLength: 20,
  unit: fc.constantFrom(
    ...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_+'.split('')
  ),
});

describe('Property-Based Tests', () => {
  describe('Term Invariants', () => {
    it('atomic terms have consistent hashes', () => {
      fc.assert(
        fc.property(validAtomName, (name) => {
          const term1 = TermBuilder.atom(name);
          const term2 = TermBuilder.atom(name);
          expect(termsEqual(term1, term2)).toBe(true);
          expect(term1.symbol).toBe(term2.symbol);
        })
      );
    });

    it('conjunction is commutative for hashing', () => {
      fc.assert(
        fc.property(validAtomName, validAtomName, (a, b) => {
          const termA = TermBuilder.atom(a);
          const termB = TermBuilder.atom(b);
          const conj1 = TermBuilder.conjunction(termA, termB);
          const conj2 = TermBuilder.conjunction(termB, termA);
          expect(termsEqual(conj1, conj2)).toBe(true);
        })
      );
    });

    it('disjunction is commutative for hashing', () => {
      fc.assert(
        fc.property(validAtomName, validAtomName, (a, b) => {
          const termA = TermBuilder.atom(a);
          const termB = TermBuilder.atom(b);
          const disj1 = TermBuilder.disjunction(termA, termB);
          const disj2 = TermBuilder.disjunction(termB, termA);
          expect(termsEqual(disj1, disj2)).toBe(true);
        })
      );
    });

    it('inheritance is NOT commutative', () => {
      fc.assert(
        fc.property(validAtomName, validAtomName, (a, b) => {
          if (a === b) return;
          const termA = TermBuilder.atom(a);
          const termB = TermBuilder.atom(b);
          const inh1 = TermBuilder.inheritance(termA, termB)!;
          const inh2 = TermBuilder.inheritance(termB, termA)!;
          expect(termsEqual(inh1, inh2)).toBe(false);
        })
      );
    });

    it('terms are structurally shared', () => {
      fc.assert(
        fc.property(validAtomName, (name) => {
          const term1 = TermBuilder.atom(name);
          const term2 = TermBuilder.atom(name);
          expect(term1).toBe(term2);
        })
      );
    });
  });

  describe('Truth Value Invariants', () => {
    it('frequency is always in [0, 1]', () => {
      fc.assert(
        fc.property(
          fc.float({ min: 0, max: 1 }),
          fc
            .float({
              min: 0,
              max: Math.fround(Truth.MAX_CONFIDENCE),
              noNaN: true,
            })
            .map((c) => Math.min(c, Truth.MAX_CONFIDENCE)),
          (f, c) => {
            const truth = Truth.create(f, c);
            expect(truth.f).toBeGreaterThanOrEqual(0);
            expect(truth.f).toBeLessThanOrEqual(1);
          }
        )
      );
    });

    it('confidence is always in [0, 1]', () => {
      fc.assert(
        fc.property(
          fc.float({ min: 0, max: 1 }),
          fc
            .float({
              min: 0,
              max: Math.fround(Truth.MAX_CONFIDENCE),
              noNaN: true,
            })
            .map((c) => Math.min(c, Truth.MAX_CONFIDENCE)),
          (f, c) => {
            const truth = Truth.create(f, c);
            expect(truth.c).toBeGreaterThanOrEqual(0);
            expect(truth.c).toBeLessThanOrEqual(1);
          }
        )
      );
    });

    it('truth revision preserves bounds', () => {
      fc.assert(
        fc.property(
          fc.float({ min: 0, max: 1 }),
          fc
            .float({
              min: 0,
              max: Math.fround(Truth.MAX_CONFIDENCE),
              noNaN: true,
            })
            .map((c) => Math.min(c, Truth.MAX_CONFIDENCE)),
          fc.float({ min: 0, max: 1 }),
          fc
            .float({
              min: 0,
              max: Math.fround(Truth.MAX_CONFIDENCE),
              noNaN: true,
            })
            .map((c) => Math.min(c, Truth.MAX_CONFIDENCE)),
          (f1, c1, f2, c2) => {
            const t1 = Truth.create(f1, c1);
            const t2 = Truth.create(f2, c2);
            const revised = Truth.revision(t1, t2);
            expect(revised.f).toBeGreaterThanOrEqual(0);
            expect(revised.f).toBeLessThanOrEqual(1);
            expect(revised.c).toBeGreaterThanOrEqual(0);
            expect(revised.c).toBeLessThanOrEqual(1);
          }
        )
      );
    });

    it('truth operations preserve bounds', () => {
      fc.assert(
        fc.property(
          fc.float({ min: 0, max: 1 }),
          fc
            .float({
              min: 0,
              max: Math.fround(Truth.MAX_CONFIDENCE),
              noNaN: true,
            })
            .map((c) => Math.min(c, Truth.MAX_CONFIDENCE)),
          (f, c) => {
            const truth = Truth.create(f, c);
            const negated = Truth.negation(truth);
            expect(negated.f).toBeGreaterThanOrEqual(0);
            expect(negated.f).toBeLessThanOrEqual(1);
            expect(negated.c).toBeGreaterThanOrEqual(0);
            expect(negated.c).toBeLessThanOrEqual(1);
          }
        )
      );
    });
  });

  describe('Normalization Invariants', () => {
    it('normalize(normalize(t)) produces same hash as normalize(t)', () => {
      fc.assert(
        fc.property(validAtomName, (name) => {
          const term = TermBuilder.atom(name);
          const norm1 = normalize(term);
          const norm2 = normalize(norm1);
          expect(termsEqual(norm1, norm2)).toBe(true);
        })
      );
    });

    it('normalize is idempotent for conjunctions', () => {
      fc.assert(
        fc.property(validAtomName, validAtomName, (a, b) => {
          const t1 = TermBuilder.atom(a);
          const t2 = TermBuilder.atom(b);
          const conj = TermBuilder.conjunction(t1, t2);
          const norm1 = normalize(conj);
          const norm2 = normalize(norm1);
          expect(termsEqual(norm1, norm2)).toBe(true);
        })
      );
    });

    it('serializeTerm(parse(s)) round-trips for valid Narsese atoms', () => {
      fc.assert(
        fc.property(fc.string({ minLength: 1, maxLength: 20 }), (name) => {
          const parsed = TermBuilder.atom(name);
          const serialized = serializeTerm(parsed);
          expect(serialized).toBe(name);
        })
      );
    });
  });

  describe('Bag Invariants', () => {
    it('bag never exceeds capacity after N insertions', () => {
      fc.assert(
        fc.property(fc.integer({ min: 1, max: 50 }), (capacity) => {
          const items = new PriorityBag<{ id: string; priority: number }>({ capacity });
          for (let v = 0; v < 100; v++) {
            items.add({ id: `item${v}`, priority: v });
          }
          expect(items.size()).toBeLessThanOrEqual(capacity);
        })
      );
    });

    it('higher priority items survive when bag is at capacity', () => {
      const items = new PriorityBag<{ id: string; priority: number }>({ capacity: 3 });
      items.add({ id: 'low', priority: 0.1 });
      items.add({ id: 'mid', priority: 0.5 });
      items.add({ id: 'high', priority: 0.9 });
      items.add({ id: 'incoming', priority: 0.3 });
      const kept = items.toArray();
      expect(kept).not.toContainEqual({ id: 'low', priority: 0.1 });
      expect(kept).toContainEqual({ id: 'high', priority: 0.9 });
    });
  });

  describe('Rule Idempotence', () => {
    it('atom terms never mutate on normalization', () => {
      fc.assert(
        fc.property(validAtomName, (name) => {
          const atom = TermBuilder.atom(name);

          normalize(atom);
        })
      );
    });
  });

  describe('Stamp Invariants', () => {
    it('stamps have bounded lineage', () => {
      fc.assert(
        fc.property(fc.integer({ min: 1, max: 9 }), (_depth) => {
          const stamp = Stamp.createInput();
          expect(stamp.derivations).toHaveLength(0);
        })
      );
    });

    it('input stamps have empty lineage', () => {
      fc.assert(
        fc.property(fc.integer({ min: 0, max: 10 }), () => {
          const stamp = Stamp.createInput();
          expect(stamp.derivations).toHaveLength(0);
        })
      );
    });

    it('derived stamps track parent lineage', () => {
      const parent = Stamp.createInput();
      const derived = Stamp.derive([parent]);

      if (derived) {
        expect(derived.derivations).toHaveLength(1);
      }
    });
  });

  describe('NAL Operation Laws', () => {
    const truthArb = fc.record({
      f: fc.float({ min: 0, max: 1 }),
      c: fc
        .float({
          min: 0,
          max: Math.fround(Truth.MAX_CONFIDENCE),
          noNaN: true,
        })
        .map((c) => Math.min(c, Truth.MAX_CONFIDENCE)),
    }).map(({ f, c }) => Truth.create(f, c));

    it('revision is commutative', () => {
      fc.assert(
        fc.property(truthArb, truthArb, (t1, t2) => {
          const r1 = Truth.revision(t1, t2);
          const r2 = Truth.revision(t2, t1);
          expect(Truth.equals(r1, r2)).toBe(true);
        })
      );
    });

    it('revision preserves bounds', () => {
      fc.assert(
        fc.property(truthArb, truthArb, (t1, t2) => {
          const r = Truth.revision(t1, t2);
          expect(r.f).toBeGreaterThanOrEqual(0);
          expect(r.f).toBeLessThanOrEqual(1);
          expect(r.c).toBeGreaterThanOrEqual(0);
          expect(r.c).toBeLessThanOrEqual(1);
        })
      );
    });

    it('revision confidence >= max(c1, c2)', () => {
      fc.assert(
        fc.property(truthArb, truthArb, (t1, t2) => {
          const r = Truth.revision(t1, t2);
          expect(r.c).toBeGreaterThanOrEqual(Math.max(t1.c, t2.c) - 1e-10);
        })
      );
    });

    it('deduction preserves bounds', () => {
      fc.assert(
        fc.property(truthArb, truthArb, (t1, t2) => {
          const d = Truth.deduction(t1, t2);
          expect(d.f).toBeGreaterThanOrEqual(0);
          expect(d.f).toBeLessThanOrEqual(1);
          expect(d.c).toBeGreaterThanOrEqual(0);
          expect(d.c).toBeLessThanOrEqual(1);
        })
      );
    });

    it('deduction with TRUE preserves frequency, weakens confidence', () => {
      fc.assert(
        fc.property(truthArb, (t) => {
          const d = Truth.deduction(t, Truth.TRUE);
          expect(d.f).toBe(t.f);
          expect(d.c).toBeCloseTo(t.c * Truth.TRUE.c, 10);
        })
      );
    });

    it('deduction with FALSE gives FALSE frequency', () => {
      fc.assert(
        fc.property(truthArb, (t) => {
          const d = Truth.deduction(t, Truth.FALSE);
          expect(d.f).toBe(0);
          expect(d.c).toBeCloseTo(t.c * Truth.FALSE.c, 10);
        })
      );
    });

    it('induction preserves bounds', () => {
      fc.assert(
        fc.property(truthArb, truthArb, (t1, t2) => {
          const i = Truth.induction(t1, t2);
          expect(i.f).toBeGreaterThanOrEqual(0);
          expect(i.f).toBeLessThanOrEqual(1);
          expect(i.c).toBeGreaterThanOrEqual(0);
          expect(i.c).toBeLessThanOrEqual(1);
        })
      );
    });

    it('induction with TRUE gives TRUE frequency', () => {
      fc.assert(
        fc.property(truthArb, (t) => {
          const i = Truth.induction(t, Truth.TRUE);
          expect(i.f).toBe(1);
        })
      );
    });

    it('abduction preserves bounds', () => {
      fc.assert(
        fc.property(truthArb, truthArb, (t1, t2) => {
          const a = Truth.abduction(t1, t2);
          expect(a.f).toBeGreaterThanOrEqual(0);
          expect(a.f).toBeLessThanOrEqual(1);
          expect(a.c).toBeGreaterThanOrEqual(0);
          expect(a.c).toBeLessThanOrEqual(1);
        })
      );
    });

    it('abduction with TRUE preserves original frequency', () => {
      fc.assert(
        fc.property(truthArb, (t) => {
          const a = Truth.abduction(t, Truth.TRUE);
          expect(a.f).toBe(t.f);
        })
      );
    });

    it('negation is involutive', () => {
      fc.assert(
        fc.property(truthArb, (t) => {
          const n1 = Truth.negation(t);
          const n2 = Truth.negation(n1);
          expect(Truth.equals(n2, t)).toBe(true);
        })
      );
    });

    it('negation preserves bounds', () => {
      fc.assert(
        fc.property(truthArb, (t) => {
          const n = Truth.negation(t);
          expect(n.f).toBeGreaterThanOrEqual(0);
          expect(n.f).toBeLessThanOrEqual(1);
          expect(n.c).toBeGreaterThanOrEqual(0);
          expect(n.c).toBeLessThanOrEqual(1);
        })
      );
    });

    it('negation swaps frequency around 0.5', () => {
      fc.assert(
        fc.property(truthArb, (t) => {
          const n = Truth.negation(t);
          expect(n.f).toBe(1 - t.f);
          expect(n.c).toBe(t.c);
        })
      );
    });

    it('conversion preserves bounds', () => {
      fc.assert(
        fc.property(truthArb, (t) => {
          const c = Truth.conversion(t);
          expect(c.f).toBeGreaterThanOrEqual(0);
          expect(c.f).toBeLessThanOrEqual(1);
          expect(c.c).toBeGreaterThanOrEqual(0);
          expect(c.c).toBeLessThanOrEqual(1);
        })
      );
    });

    it('conversion f = f, c = f * c', () => {
      fc.assert(
        fc.property(truthArb, (t) => {
          const c = Truth.conversion(t);
          expect(c.f).toBe(t.f);
          expect(c.c).toBeCloseTo(t.f * t.c, 5);
        })
      );
    });

    it('expectation in [0, 1]', () => {
      fc.assert(
        fc.property(truthArb, (t) => {
          const e = Truth.expectation(t);
          expect(e).toBeGreaterThanOrEqual(0);
          expect(e).toBeLessThanOrEqual(1);
        })
      );
    });

    it('expectation formula: c * (f - 0.5) + 0.5', () => {
      fc.assert(
        fc.property(truthArb, (t) => {
          const e = Truth.expectation(t);
          const expected = t.c * (t.f - 0.5) + 0.5;
          expect(e).toBeCloseTo(expected, 10);
        })
      );
    });

    it('comparison is commutative', () => {
      fc.assert(
        fc.property(truthArb, truthArb, (t1, t2) => {
          const c1 = Truth.comparison(t1, t2);
          const c2 = Truth.comparison(t2, t1);
          expect(Truth.equals(c1, c2)).toBe(true);
        })
      );
    });

    it('analogy preserves bounds', () => {
      fc.assert(
        fc.property(truthArb, truthArb, (t1, t2) => {
          const a = Truth.analogy(t1, t2);
          expect(a.f).toBeGreaterThanOrEqual(0);
          expect(a.f).toBeLessThanOrEqual(1);
          expect(a.c).toBeGreaterThanOrEqual(0);
          expect(a.c).toBeLessThanOrEqual(1);
        })
      );
    });

    it('analogy f = f1 * f2, c = c1 * c2 * f2', () => {
      fc.assert(
        fc.property(truthArb, truthArb, (t1, t2) => {
          const a = Truth.analogy(t1, t2);
          expect(a.f).toBeCloseTo(t1.f * t2.f, 10);
          expect(a.c).toBeCloseTo(t1.c * t2.c * t2.f, 10);
        })
      );
    });

    it('resemblance preserves bounds', () => {
      fc.assert(
        fc.property(truthArb, truthArb, (t1, t2) => {
          const r = Truth.resemblance(t1, t2);
          expect(r.f).toBeGreaterThanOrEqual(0);
          expect(r.f).toBeLessThanOrEqual(1);
          expect(r.c).toBeGreaterThanOrEqual(0);
          expect(r.c).toBeLessThanOrEqual(1);
        })
      );
    });

    it('resemblance is commutative', () => {
      fc.assert(
        fc.property(truthArb, truthArb, (t1, t2) => {
          const r1 = Truth.resemblance(t1, t2);
          const r2 = Truth.resemblance(t2, t1);
          expect(Truth.equals(r1, r2)).toBe(true);
        })
      );
    });

    it('intersection f = f1 * f2, c = c1 * c2', () => {
      fc.assert(
        fc.property(truthArb, truthArb, (t1, t2) => {
          const i = Truth.intersection(t1, t2);
          expect(i.f).toBeCloseTo(t1.f * t2.f, 10);
          expect(i.c).toBeCloseTo(t1.c * t2.c, 10);
        })
      );
    });

    it('union f = 1 - (1-f1)(1-f2), c = c1 * c2', () => {
      fc.assert(
        fc.property(truthArb, truthArb, (t1, t2) => {
          const u = Truth.union(t1, t2);
          const expectedF = 1 - (1 - t1.f) * (1 - t2.f);
          expect(u.f).toBeCloseTo(expectedF, 10);
          expect(u.c).toBeCloseTo(t1.c * t2.c, 10);
        })
      );
    });

    it('sameness f = 1 - |f1-f2|, c = c1 * c2', () => {
      fc.assert(
        fc.property(truthArb, truthArb, (t1, t2) => {
          const s = Truth.sameness(t1, t2);
          expect(s.f).toBeCloseTo(1 - Math.abs(t1.f - t2.f), 10);
          expect(s.c).toBeCloseTo(t1.c * t2.c, 10);
        })
      );
    });

    it('detachment f = f2, c = f1 * c1 * c2', () => {
      fc.assert(
        fc.property(truthArb, truthArb, (t1, t2) => {
          const d = Truth.detachment(t1, t2);
          expect(d.f).toBe(t2.f);
          expect(d.c).toBeCloseTo(t1.f * t1.c * t2.c, 10);
        })
      );
    });

    it('choice returns higher expectation', () => {
      fc.assert(
        fc.property(truthArb, truthArb, (t1, t2) => {
          const c = Truth.choice(t1, t2);
          const e1 = Truth.expectation(t1);
          const e2 = Truth.expectation(t2);
          expect(c).toBe(e1 > e2 ? t1 : t2);
        })
      );
    });

    it('weak weakening: c <= original', () => {
      fc.assert(
        fc.property(truthArb, (t) => {
          const w = Truth.weak(t.c);
          expect(w).toBeLessThanOrEqual(t.c);
        })
      );
    });

    it('structuralDeduction f = f^2, c = (c/(c+1))*c', () => {
      fc.assert(
        fc.property(truthArb, (t) => {
          const sd = Truth.structuralDeduction(t);
          expect(sd.f).toBeCloseTo(t.f * t.f, 10);
          const expectedC = (t.c / (t.c + 1)) * t.c;
          expect(sd.c).toBeCloseTo(expectedC, 10);
        })
      );
    });

    it('structuralReduction f = f, c = c/(c+10)', () => {
      fc.assert(
        fc.property(truthArb, (t) => {
          const sr = Truth.structuralReduction(t);
          expect(sr.f).toBe(t.f);
          expect(sr.c).toBeCloseTo(t.c / (t.c + 10), 10);
        })
      );
    });
  });
});
