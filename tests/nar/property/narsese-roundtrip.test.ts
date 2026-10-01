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
      .chain((arity) => fc.array(atomArb, { minLength: arity, maxLength: arity }))
      .map((args) => TermBuilder.compound(kind, args)),
  ])
);

const compoundArb: fc.Arbitrary<Term> = fc
  .constantFrom(...KIND_ARBS.keys())
  .chain((k) => KIND_ARBS.get(k)!);

const termArb: fc.Arbitrary<Term> = fc.oneof(
  { arbitrary: atomArb, weight: 3 },
  { arbitrary: compoundArb, weight: 7 }
);

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
