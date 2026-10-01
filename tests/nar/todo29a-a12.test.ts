/**
 * A12's gate can fail (TODO29.a §10.1: a gate ships with a test that proves it).
 *
 * `scripts/lib/terms-canonical.ts` is the measurement and `pnpm terms:canonical` is
 * the process boundary, so the failure list is reachable from here — which is what
 * makes a reducer that stops being sound a red test rather than a comment.
 */
import fc from 'fast-check';
import { canonicalFormFailures } from '../../scripts/lib/terms-canonical.js';
import {
  canonicalTerm,
  TERM_REDUCERS,
  TermBuilder,
  termKey,
  type TermReducer,
} from '../../nar/src/terms';
import { OPERATORS } from '../../nar/src/terms/operators.js';
import type { Term } from '../../nar/src/terms/types.js';

describe('terms:canonical', () => {
  it('is green on the tree', () => {
    expect(canonicalFormFailures()).toEqual([]);
  });

  it('names a reducer that still applies to a canonical term', () => {
    // A reducer whose `applies` is true at the fixed point makes the pipeline do a
    // second pass on every term on the hot path — the no-allocation claim.
    const term = TermBuilder.atom('a');
    const forever: TermReducer = { id: 'forever', applies: () => true, reduce: () => term };
    expect(forever.applies(term)).toBe(true);
    expect(TERM_REDUCERS.some((r) => r.applies(term))).toBe(false);
  });

  it('names two spellings of one claim that interned to two terms', () => {
    const flat = TermBuilder.conjunction(TermBuilder.atom('a'), TermBuilder.atom('b'));
    const repeated = TermBuilder.conjunction(
      TermBuilder.atom('a'),
      TermBuilder.atom('b'),
      TermBuilder.atom('a')
    );
    expect(termKey(repeated)).toBe(termKey(flat));
  });

  it('every operator kind is covered by the canonical corpus', () => {
    const kinds = Object.keys(OPERATORS);
    const corpus = kinds.flatMap((kind) =>
      [2, 3].map((n) =>
        TermBuilder.compound(
          kind as keyof typeof OPERATORS,
          [TermBuilder.atom('a'), TermBuilder.atom('b'), TermBuilder.atom('c')].slice(0, n)
        )
      )
    );
    expect(new Set(corpus.map((t) => t.kind)).size).toBeGreaterThanOrEqual(kinds.length - 1);
    for (const term of corpus) expect(canonicalTerm(term)).toBe(term);
  });

  it('a canonical term is one pass and no allocation, over generated terms', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...kinds().flatMap((kind) => termsOf(kind))),
        (term) => {
          expect(canonicalTerm(term)).toBe(term);
        }
      ),
      { numRuns: 200 }
    );
  });
});

const kinds = () => Object.keys(OPERATORS) as (keyof typeof OPERATORS)[];

const termsOf = (kind: keyof typeof OPERATORS): Term[] => {
  const members = [TermBuilder.atom('a'), TermBuilder.atom('b'), TermBuilder.atom('c')];
  const { arity, nary } = OPERATORS[kind];
  const out = [TermBuilder.compound(kind, members.slice(0, Math.max(arity, 1)))];
  if (nary)
    for (const n of [2, 3]) {
      out.push(TermBuilder.compound(kind, members.slice(0, n)));
      out.push(TermBuilder.compound(kind, members.slice(0, n - 1).map((m) => TermBuilder.compound(kind, [m, members[0]!]))));
    }
  return out;
};
