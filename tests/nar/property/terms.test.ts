import fc from 'fast-check';
import type { Term } from '../../../nar/src';
import { normalize, TermBuilder, termsEqual } from '../../../nar/src/terms';

// Valid atom characters (excluding reserved: (){}[]<>.,!%;:@ \t\n\r=&/|>- and :)
// Also allow variable prefixes ? $ # * % at start
const validAtomCharSet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_+=-*/';
const validAtomStr = fc.string({ minLength: 1, maxLength: 10 }).map((s) => s.split('').filter(c => validAtomCharSet.includes(c)).join('')).filter((s) => s.length > 0);
const atomArb = validAtomStr.map((s) => TermBuilder.atom(s));
const termArb: fc.Arbitrary<Term> = fc.oneof(
  atomArb,
  fc.tuple(atomArb, atomArb).map(([a, b]) => TermBuilder.inheritance(a, b)).filter((t): t is Term => t !== undefined),
  fc.tuple(atomArb, atomArb).map(([a, b]) => TermBuilder.conjunction(a, b))
) as fc.Arbitrary<Term>;

const hashOf = (t: Term): unknown => (t as unknown as { hash?: unknown }).hash;

describe('Term invariants (property)', () => {
  it('normalization is idempotent', () => {
    fc.assert(
      fc.property(termArb, (t) => {
        const n1 = normalize(t);
        const n2 = normalize(n1);
        expect(termsEqual(n1, n2)).toBe(true);
        expect(hashOf(n1)).toBe(hashOf(n2));
      })
    );
  });

  it('conjunction order independence', () => {
    fc.assert(
      fc.property(atomArb, atomArb, (a, b) => {
        expect(hashOf(TermBuilder.conjunction(a, b)!)).toBe(hashOf(TermBuilder.conjunction(b, a)!));
      })
    );
  });

  it('factory structural sharing', () => {
    fc.assert(
      fc.property(validAtomStr, (s) => {
        expect(TermBuilder.atom(s)).toBe(TermBuilder.atom(s));
      })
    );
  });
});
