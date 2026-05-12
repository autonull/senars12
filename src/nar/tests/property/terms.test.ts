import fc from 'fast-check';
import type {Term} from '../../terms';
import {TermBuilder, termsEqual} from '../../terms';
import {normalize} from '../../terms';

const atomArb = fc.string({minLength: 1, maxLength: 10}).map(s => TermBuilder.atom(s));
const termArb: fc.Arbitrary<Term> = fc.oneof(
    atomArb,
    fc.tuple(atomArb, atomArb).map(([a, b]) => TermBuilder.inheritance(a, b)),
    fc.tuple(atomArb, atomArb).map(([a, b]) => TermBuilder.conjunction(a, b)),
) as fc.Arbitrary<Term>;

describe('Term invariants (property)', () => {
    it('normalization is idempotent', () => {
        fc.assert(fc.property(termArb, t => {
            const n1 = normalize(t);
            const n2 = normalize(n1);
            expect(termsEqual(n1, n2)).toBe(true);
            expect(n1.hash).toBe(n2.hash);
        }));
    });

    it('conjunction order independence', () => {
        fc.assert(fc.property(atomArb, atomArb, (a, b) => {
            expect(TermBuilder.conjunction(a, b).hash)
                .toBe(TermBuilder.conjunction(b, a).hash);
        }));
    });

    it('factory structural sharing', () => {
        fc.assert(fc.property(fc.string(), s => {
            expect(TermBuilder.atom(s)).toBe(TermBuilder.atom(s));
        }));
    });
});
