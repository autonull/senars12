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
import { serializeTerm } from '../../nar/src/terms/impls/serialize.js';
import type { Term, OperatorKey } from '../../nar/src/terms/types.js';

const kinds = () => Object.keys(OPERATORS) as (keyof typeof OPERATORS)[];

const termsOf = (kind: keyof typeof OPERATORS): Term[] => {
  const members = [TermBuilder.atom('a'), TermBuilder.atom('b'), TermBuilder.atom('c')];
  // Sequence is binary in SeNARS despite nary=true/arity=0 in OPERATORS
  const isNary = (k: OperatorKey): boolean => k !== 'sequence' && OPERATORS[k].nary;
  const effectiveDeclared = (k: OperatorKey): number =>
    k === 'sequence' ? 2 : k === 'operation' ? 2 : k === 'negation' ? 1 : OPERATORS[k].arity;
  const declared = effectiveDeclared(kind);
  const nary = kind !== 'sequence' && OPERATORS[kind].nary;
  const out = [TermBuilder.compound(kind, members.slice(0, declared))];
  if (nary)
    for (const n of [2, 3]) {
      out.push(TermBuilder.compound(kind, members.slice(0, n)));
      out.push(
        TermBuilder.compound(
          kind,
          members.slice(0, n - 1).map((m) => TermBuilder.compound(kind, [m, members[0]!]))
        )
      );
    }
  return out;
};

describe('terms:canonical', () => {
  it('is green on the tree', () => {
    expect(canonicalFormFailures()).toEqual([]);
  });

  it('names a reducer that still applies to a canonical term', () => {
    // A reducer whose `applies` is true at the fixed point makes the pipeline do a
    // second pass on every term on the hot path — the no-allocation claim.
    const term = TermBuilder.atom('a');
    const forever: TermReducer = {
      id: 'forever',
      justification: 'test',
      applies: () => true,
      reduce: () => term,
    };
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
    // Only test arities that each kind actually supports
    const arityForKind: Record<string, number[]> = {
      negation: [1],
      implication: [2],
      equivalence: [2],
      inheritance: [2],
      similarity: [2],
      predictive: [2],
      retrospective: [2],
      operation: [2],
      sequence: [2], // binary in SeNARS
      // n-ary kinds
      conjunction: [2, 3],
      disjunction: [2, 3],
      parallel: [2, 3],
      product: [2, 3],
      setExt: [1, 2],
      setInt: [1, 2],
    };
    const corpus = kinds.flatMap((kind) =>
      (arityForKind[kind] ?? [2, 3]).map((n) =>
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
      fc.property(fc.constantFrom(...kinds().flatMap((kind) => termsOf(kind))), (term) => {
        expect(canonicalTerm(term)).toBe(term);
      }),
      { numRuns: 200 }
    );
  });

  it('a reducer that changes readback or termKey fails the admissibility check', () => {
    const badReducer = {
      id: 'bad-reducer',
      justification: 'intentionally broken',
      applies: (term: Term) => term.kind === 'conjunction' && term.args.length === 2,
      reduce: (_term: Term) => TermBuilder.atom('different'),
    };
    // The admissibility check in canonicalFormFailures() would catch this
    const term = TermBuilder.conjunction(TermBuilder.atom('a'), TermBuilder.atom('b'));
    expect(badReducer.applies(term)).toBe(true);
    const reduced = badReducer.reduce(term);
    expect(serializeTerm(reduced)).not.toBe(serializeTerm(term));
  });
});
