import fc from 'fast-check';
import { Truth, isTruthEqual } from '../../../nar/src/terms';

const MAX_C = Math.min(Math.fround(Truth.MAX_CONFIDENCE), Truth.MAX_CONFIDENCE);
/** Largest f32-representable value ≤ x (fast-check requires f32-exact bounds). */
const f32Floor = (x: number): number => {
  let lo = Math.fround(x * (1 - 2 ** -20));
  let hi = Math.fround(x);
  for (let i = 0; i < 80; i++) {
    const m = Math.fround((lo + hi) / 2);
    if (m <= x && m > lo) lo = m;
    else hi = m;
  }
  return lo;
};
const MAX_C_F32 = f32Floor(MAX_C);

/** Well-formed truth values: confidence > 0 (zero-confidence is degenerate —
 *  revision divides by total weight and is not required to be meaningful). */
const truthArb = fc
  .tuple(
    fc.float({ min: 0, max: 1, noNaN: true }),
    fc.float({ min: Math.fround(1e-3), max: MAX_C_F32, noNaN: true })
  )
  .map(([f, c]) => Truth.create(f, c));

describe('Truth algebra laws (property)', () => {
  it('self-revision preserves frequency', () => {
    fc.assert(
      fc.property(truthArb, (t) => {
        const revised = Truth.revision(t, t);
        expect(Math.abs(revised.f - t.f)).toBeLessThan(1e-9);
      }),
      { numRuns: 300 }
    );
  });

  it('revision is commutative (within tolerance)', () => {
    fc.assert(
      fc.property(truthArb, truthArb, (a, b) => {
        expect(isTruthEqual(Truth.revision(a, b), Truth.revision(b, a))).toBe(true);
      }),
      { numRuns: 300 }
    );
  });

  it('deduction stays in [0,1]×[0,MAX_C]', () => {
    fc.assert(
      fc.property(truthArb, truthArb, (a, b) => {
        const d = Truth.deduction(a, b);
        expect(d.f).toBeGreaterThanOrEqual(0);
        expect(d.f).toBeLessThanOrEqual(1);
        expect(d.c).toBeGreaterThanOrEqual(0);
        expect(d.c).toBeLessThanOrEqual(MAX_C + 1e-9);
      }),
      { numRuns: 300 }
    );
  });

  it('expectation is monotone in frequency (fixed confidence)', () => {
    fc.assert(
      fc.property(
        fc.float({ min: 0, max: Math.fround(0.99), noNaN: true }),
        fc.float({ min: Math.fround(1e-3), max: MAX_C_F32, noNaN: true }),
        (f, c) => {
          const lo = Truth.expectation(Truth.create(f, c));
          const hi = Truth.expectation(Truth.create(Math.min(1, f + 0.01), c));
          expect(hi).toBeGreaterThanOrEqual(lo);
        }
      ),
      { numRuns: 300 }
    );
  });
});
