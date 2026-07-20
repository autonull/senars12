import { Truth } from '@senars/nar';
import fc from 'fast-check';

function truthArb() {
  return fc
    .tuple(
      fc.double({ min: 0, max: 1, noNaN: true }),
      fc.double({ min: 0, max: 0.999, noNaN: true })
    )
    .map(([f, c]) => Truth.create(f, c));
}

describe('Truth value properties', () => {
  it('frequency and confidence stay within bounds for all binary operations', () => {
    fc.assert(
      fc.property(truthArb(), truthArb(), (a, b) => {
        const ops = [
          Truth.deduction,
          Truth.induction,
          Truth.abduction,
          Truth.intersection,
          Truth.union,
          Truth.comparison,
          Truth.analogy,
          Truth.resemblance,
          Truth.contraposition,
          Truth.subtract,
          Truth.diff,
          Truth.exemplification,
          Truth.sameness,
          Truth.detachment,
          Truth.revision,
          Truth.revisionWeak,
        ];
        for (const op of ops) {
          const r = op(a, b);
          expect(r.f).toBeGreaterThanOrEqual(0);
          expect(r.f).toBeLessThanOrEqual(1);
          expect(r.c).toBeGreaterThanOrEqual(0);
          expect(r.c).toBeLessThanOrEqual(0.999);
        }
      })
    );
  });

  it('negation is involutive', () => {
    fc.assert(
      fc.property(truthArb(), (t) => {
        const negated = Truth.negation(t);
        const restored = Truth.negation(negated);
        expect(Truth.equals(restored, t)).toBe(true);
      })
    );
  });

  it('deduction confidence never exceeds either premise confidence', () => {
    fc.assert(
      fc.property(truthArb(), truthArb(), (a, b) => {
        const r = Truth.deduction(a, b);
        expect(r.c).toBeLessThanOrEqual(a.c);
        expect(r.c).toBeLessThanOrEqual(b.c);
      })
    );
  });

  it('revision confidence is at least the stronger premise confidence', () => {
    fc.assert(
      fc.property(truthArb(), truthArb(), (a, b) => {
        const r = Truth.revision(a, b);
        expect(r.c).toBeGreaterThanOrEqual(Math.min(a.c, b.c) - 1e-9);
      })
    );
  });

  it('serialize/deserialize round-trips frequency and confidence', () => {
    fc.assert(
      fc.property(truthArb(), (t) => {
        const restored = Truth.deserialize(Truth.serialize(t));
        expect(restored).not.toBeNull();
        if (restored) expect(Truth.equals(restored, t)).toBe(true);
      })
    );
  });

  it('expectation is monotonic in frequency for fixed confidence', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 1, noNaN: true }),
        fc.double({ min: 0, max: 1, noNaN: true }),
        fc.double({ min: 0.01, max: 0.999, noNaN: true }),
        (f1, f2, c) => {
          const e1 = Truth.expectation(Truth.create(f1, c));
          const e2 = Truth.expectation(Truth.create(f2, c));
          if (f1 <= f2) expect(e1).toBeLessThanOrEqual(e2);
          else expect(e1).toBeGreaterThanOrEqual(e2);
        }
      )
    );
  });
});
