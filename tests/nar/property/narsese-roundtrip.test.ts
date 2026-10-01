import { readFileSync } from 'node:fs';
import fc from 'fast-check';
import type { OperatorKey, Term } from '../../../nar/src/terms';
import { OPERATORS, serializeTerm, TermBuilder, termsEqual } from '../../../nar/src/terms';
import { termParser } from '../../../nar/src/terms/impls/parser-peggy.js';

/** Parser-safe atom names (Narsese atoms: letters/digits, no reserved chars). */
const atomNameArb = fc
  .string({ minLength: 1, maxLength: 8 })
  .filter((s) => /^[a-zA-Z][a-zA-Z0-9]*$/.test(s));

const atomArb = atomNameArb.map((s) => TermBuilder.atom(s)!);

/** Kinds that take one argument whatever their declared arity. */
const UNARY_KINDS = new Set<OperatorKey>(['negation', 'setExt', 'setInt']);

/** A kind that takes exactly `arity` arguments, so a nested node can be placed. */
const KIND_BY_ARITY = new Map<number, OperatorKey>([
  ...([...UNARY_KINDS] as OperatorKey[]).map((kind) => [1, kind] as const),
  ...(
    [
      'inheritance',
      'implication',
      'similarity',
      'operation',
      'equivalence',
      'predictive',
      'retrospective',
    ] as OperatorKey[]
  ).map((kind) => [2, kind] as const),
  ...(['conjunction', 'disjunction', 'sequence', 'parallel'] as OperatorKey[]).map(
    (kind) => [2, kind] as const
  ),
  [3, 'product'] as const,
] as [number, OperatorKey][]);

/**
 * Atoms at the leaves and one compound above them.
 *
 * This used to be atoms only, and that was the gate's blind spot: a failure that
 * needs a compound to reach it cannot be seen by a generator that never builds
 * one. With atomic arguments no product ever held a statement, so the printed
 * form of an operation with more than one argument was never tried at all.
 *
 * It stops at two members and one level of nesting because deeper runs into a
 * hole that is older
 * than this gate and is not about operators at all: **no n-ary statement can be
 * read back as an operand.** `(a&b&c)`, `(a&|b&|c)` and `(a&/b&/c)` are all
 * parse failures, so `((a&|b&|c)-->d)` is too, and no property over them can
 * hold. TODO29.a §0.8.4 records it; the grammar's `Term` has no rule for an
 * unparenthesised operator chain, so `CompoundTerm`'s product arm stops at the
 * first operand and the rest of the chain is left over.
 */
const nestedAt = (depth: number): fc.Arbitrary<Term> =>
  depth === 0
    ? atomArb
    : fc
        .integer({ min: 1, max: 2 })
        .chain((arity) => fc.array(nestedAt(depth - 1), { minLength: arity, maxLength: arity }))
        .map((args) => TermBuilder.compound(KIND_BY_ARITY.get(args.length)!, args));

const nestedArb: fc.Arbitrary<Term> = nestedAt(1);

/**
 * One arbitrary per kind `OPERATORS` declares. It used to be a hand-written list
 * of the five kinds that round-tripped, which is why six kinds nobody noticed
 * could not be read back from their own output — the generator was the bug.
 */
const KIND_ARBS = new Map<OperatorKey, fc.Arbitrary<Term>>(
  (Object.keys(OPERATORS) as OperatorKey[]).map((kind) => [
    kind,
    fc
      .constant(UNARY_KINDS.has(kind) ? 1 : Math.max(OPERATORS[kind].arity, 2))
      .chain((arity) => fc.array(nestedArb, { minLength: arity, maxLength: arity }))
      .map((args) => TermBuilder.compound(kind, args)),
  ])
);

const termArb: fc.Arbitrary<Term> = nestedArb;

describe('Narsese round-trip (property)', () => {
  it.each([...KIND_ARBS.keys()])('%s reads back as itself', (kind) => {
    fc.assert(
      fc.property(KIND_ARBS.get(kind)!, (t) => {
        const serialized = serializeTerm(t);
        const reparsed = termParser.parse(serialized);
        expect(serializeTerm(reparsed)).toBe(serialized);
        expect(reparsed.kind).toBe(kind);
      }),
      { numRuns: 50 }
    );
  });

  it('every term round-trips, nested compounds included', () => {
    fc.assert(
      fc.property(termArb, (t) => {
        const serialized = serializeTerm(t);
        expect(termsEqual(t, termParser.parse(serialized))).toBe(true);
      }),
      { numRuns: 200 }
    );
  });

  it('the grammar names no kind the operator table lacks', () => {
    const grammar = readFileSync(
      new URL('../../../nar/src/terms/narsese.peggy', import.meta.url),
      'utf8'
    );
    const mapped = [...grammar.matchAll(/'[^']+'\s*:\s*'([^']+)'/g)].map(([, kind]) => kind);
    expect(mapped.length).toBeGreaterThan(0);
    for (const kind of mapped) expect(OPERATORS).toHaveProperty(kind as OperatorKey);
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
