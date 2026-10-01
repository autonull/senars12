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

/**
 * Generator bounds. Two levels of nesting and three members: past that the
 * property stops being about canonical form and starts being about the
 * parser's stack, so the cap is named rather than discovered.
 */
const MAX_DEPTH = 2;
const MAX_ARITY = 3;

/** Kinds that take one argument whatever their declared arity. */
const UNARY_KINDS = new Set<OperatorKey>(['negation', 'setExt', 'setInt']);

/** Kinds that take any number of arguments, so any arity the generator picks. */
const VARIADIC_KINDS = ['conjunction', 'disjunction', 'sequence', 'parallel', 'product'] as const;

/**
 * A kind that takes exactly `arity` arguments, so a nested node can be placed.
 * The variadic kinds answer for every arity up to {@link MAX_ARITY} — a
 * conjunction of three premises is the shape the serialiser actually writes,
 * so it is the case that was missing.
 */
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
] as [number, OperatorKey][]);
for (let arity = 2; arity <= MAX_ARITY; arity++)
  for (const kind of VARIADIC_KINDS) KIND_BY_ARITY.set(arity, kind);

/**
 * Atoms at the leaves and compounds above them, two levels deep.
 *
 * This used to be atoms only, and that was the gate's blind spot: a failure that
 * needs a compound to reach it cannot be seen by a generator that never builds
 * one. With atomic arguments no product ever held a statement, so the printed
 * form of an operation with more than one argument was never tried at all.
 *
 * It is capped at two levels for the reason it was once capped at one: that is
 * where the property stops being about canonical form and starts being about
 * the parser's stack. The cap is named rather than discovered, and it is no
 * longer hiding a hole — a three-member conjunction now serialises to the
 * prefix form `(&,a,b,c)` and reads back, which is what made arity 3 worth
 * generating at all.
 */
const nestedAt = (depth: number): fc.Arbitrary<Term> =>
  depth === 0
    ? atomArb
    : fc
        .integer({ min: 1, max: MAX_ARITY })
        .chain((arity) => fc.array(nestedAt(depth - 1), { minLength: arity, maxLength: arity }))
        .map((args) => TermBuilder.compound(KIND_BY_ARITY.get(args.length)!, args));

const nestedArb: fc.Arbitrary<Term> = nestedAt(MAX_DEPTH);

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
