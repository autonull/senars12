import fc from 'fast-check';
import { TermBuilder, serializeTerm, termsEqual } from '../../../nar/src/terms';
import { termParser } from '../../../nar/src/terms/parser-peggy.js';
import type { Term } from '../../../nar/src/terms';

/** Parser-safe atom names (Narsese atoms: letters/digits, no reserved chars). */
const atomNameArb = fc
  .string({ minLength: 1, maxLength: 8 })
  .filter((s) => /^[a-zA-Z][a-zA-Z0-9]*$/.test(s));

const atomArb = atomNameArb.map((s) => TermBuilder.atom(s)!);

const compoundArb: fc.Arbitrary<Term> = fc
  .oneof(
    fc.constant('inheritance'),
    fc.constant('similarity'),
    fc.constant('conjunction'),
    fc.constant('disjunction'),
    fc.constant('negation')
  )
  .chain((kind) =>
    kind === 'negation'
      ? atomArb.map((a) => TermBuilder.compound('negation', [a]))
      : fc.tuple(atomArb, atomArb).map(([a, b]) => TermBuilder.compound(kind, [a, b]))
  );

const termArb: fc.Arbitrary<Term> = fc.oneof({ arbitrary: atomArb, weight: 3 }, {
  arbitrary: compoundArb,
  weight: 7,
});

describe('Narsese round-trip (property)', () => {
  it('serialize → parse reproduces the term', () => {
    fc.assert(
      fc.property(termArb, (t) => {
        const serialized = serializeTerm(t);
        const reparsed = termParser.parse(serialized);
        expect(termsEqual(t, reparsed)).toBe(true);
      }),
      { numRuns: 200 }
    );
  });

  it('serialization is deterministic', () => {
    fc.assert(
      fc.property(termArb, (t) => {
        expect(serializeTerm(t)).toBe(serializeTerm(t));
      }),
      { numRuns: 100 }
    );
  });
});
