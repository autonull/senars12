import fc from 'fast-check';
import {Truth} from '../../../src/nar/terms';

const truthArb = fc.tuple(
    fc.float({min: 0, max: 1}),
    fc.float({min: 0, max: 1})
).map(([f, c]) => Truth.create(f, c));

describe('Truth invariants (property)', () => {
    it('frequency in [0,1]', () => {
        fc.assert(fc.property(fc.float(), fc.float(), (f, c) => {
            const t = Truth.create(f, c);
            expect(t.f).toBeGreaterThanOrEqual(0);
            expect(t.f).toBeLessThanOrEqual(1);
            expect(t.c).toBeGreaterThanOrEqual(0);
            expect(t.c).toBeLessThanOrEqual(1);
        }));
    });

    it('revision commutative', () => {
        fc.assert(fc.property(truthArb, truthArb, (a, b) => {
            const r1 = Truth.revision(a, b);
            const r2 = Truth.revision(b, a);
            expect(Math.abs(r1.f - r2.f)).toBeLessThan(1e-9);
            expect(Math.abs(r1.c - r2.c)).toBeLessThan(1e-9);
        }));
    });

    it('deduction truth monotonic', () => {
        fc.assert(fc.property(truthArb, truthArb, (a, b) => {
            const r = Truth.deduction(a, b);
            expect(r.f).toBeLessThanOrEqual(Math.min(a.f, b.f));
            expect(r.c).toBeLessThanOrEqual(Math.min(a.c, b.c));
        }));
    });
});
