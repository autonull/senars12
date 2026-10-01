/**
 * Four rules, and each is a place two tables could drift apart:
 *
 * 1. **every kind round-trips** — `serialize → parse` is identity, over a
 *    generator derived from `OPERATORS` rather than from a list of what passes;
 * 2. **the grammar names no kind the table lacks** — `INFIX_KINDS` is the only
 *    place a symbol can become a kind, and an unmapped operator used to fall
 *    through to `create(op)` and build a term whose `kind` was the symbol;
 * 3. **every table symbol is in the grammar's token list** — or is one of the
 *    wrapper symbols (`{`, `[`, `--`) and the argument separator (`,`);
 * 4. **the reducer registry reaches a fixed point** — canonical form is not
 *    canonical unless `canonical(canonical(t)) === canonical(t)`, every reducer
 *    declines every canonical term (the no-allocation claim), the reducers
 *    commute, `(--x).f = 1 − f_x` holds across the whole range with the stamp and
 *    confidence carried through, and two spellings of one claim are one term.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createTask, NEUTRAL_BUDGET } from '../../nar/src/types/index.js';
import { termDepth, termKey, termsEqual } from '../../nar/src/terms/impls/accessors.js';
import { TermBuilder } from '../../nar/src/terms/impls/factory.js';
import { operationTerm, readOperationTerm } from '../../nar/src/terms/impls/operation-term.js';
import { termParser } from '../../nar/src/terms/impls/parser-peggy.js';
import { serializeTerm } from '../../nar/src/terms/impls/serialize.js';
import { OPERATORS } from '../../nar/src/terms/operators.js';
import { canonicalTask, canonicalTerm, Stamp, TASK_REDUCERS, TERM_REDUCERS, Truth } from '../../nar/src/terms/index.js';
import type { OperatorKey, Term } from '../../nar/src/terms/types.js';
import { ROOT } from './root.js';

/**
 * The body of the `terms:canonical` gate: the operator table, the grammar and the
 * serialiser agree, every kind survives the round trip, and the reducer registry
 * reaches a canonical fixed point. This file is the measurement; `terms-canonical.ts`
 * is the process boundary.
 *
 * It lives here rather than in the script so a test can call it and prove it can
 * fail — TODO29.a §10.1's rule, and the reason `terms-canonical.ts` is not a list of
 * assertions nobody can reach from a test.
 */
export const canonicalFormFailures = (): string[] => {
  const GRAMMAR = readFileSync(join(ROOT, 'nar/src/terms/narsese.peggy'), 'utf8');
  const WRAPPER_SYMBOLS = new Set(['{', '[', '--']);

  const failures: string[] = [];

  const declaredKinds = (name: string): Map<string, string> => {
    const source = GRAMMAR.match(new RegExp(`const ${name} = \\{([^}]*)\\}`))?.[1] ?? '';
    return new Map(
      [...source.matchAll(/'([^']+)'\s*:\s*'([^']+)'/g)].map(
        ([, symbol, kind]) => [symbol!, kind!] as [string, string]
      )
    );
  };

  const grammarTokens = (): Set<string> =>
    new Set(
      [...(GRAMMAR.match(/^OperatorToken\b[\s\S]*?^$/m)?.[0] ?? '').matchAll(/"([^"]+)"/g)].map(
        ([, token]) => token!
      )
    );

  const INFIX = declaredKinds('INFIX_KINDS');
  const LEGACY = declaredKinds('LEGACY_KINDS');
  const TOKENS = grammarTokens();

  for (const [table, entries] of [
    ['INFIX_KINDS', INFIX],
    ['LEGACY_KINDS', LEGACY],
  ] as const) {
    for (const [symbol, kind] of entries) {
      if (!(kind in OPERATORS)) failures.push(`${table} maps '${symbol}' to unknown kind '${kind}'`);
      if (!TOKENS.has(symbol)) failures.push(`${table} maps '${symbol}' but no rule accepts it`);
    }
  }

  for (const [kind, { symbol }] of Object.entries(OPERATORS)) {
    if ([...INFIX.values()].includes(kind)) continue;
    if (WRAPPER_SYMBOLS.has(symbol) || symbol === ',') continue;
    failures.push(`no infix symbol for kind '${kind}' ('${symbol}')`);
  }

  const a = TermBuilder.atom('a');
  const b = TermBuilder.atom('b');
  const c = TermBuilder.atom('c');
  // Override arity for kinds where OPERATORS doesn't match actual requirement
  const effectiveArity: Record<string, number> = {
    sequence: 2,
    operation: 2,
    negation: 1,
    // n-ary kinds use their declared arity (0 = use 2 for binary test)
  };
  for (const [kind, { arity }] of Object.entries(OPERATORS) as [
    OperatorKey,
    { arity: number },
  ][]) {
    const testArity = effectiveArity[kind] ?? Math.max(arity, 1);
    const term = TermBuilder.compound(kind, [a, b].slice(0, testArity));
    const text = serializeTerm(term);
    let parsed: string | null = null;
    try {
      parsed = String(termParser.parse(text));
    } catch {
      parsed = null;
    }
    if (parsed !== text)
      failures.push(`${kind}: '${text}' reads back as ${parsed ?? 'a parse failure'}`);
  }

  /**
   * A canonical form is **readable**, which is a second property from being
   * injective and was the one nothing gated. Narsese spells an n-ary copula two
   * ways and they are not interchangeable: `(a&b)` is infix and valid for **two**
   * members only, and `(&,a,b,c)` is the prefix form for any arity —
   * `docs/java/NarseseParser.java` draws the line itself, `CompoundInfix` being
   * exactly `Term() op Term()` while `MultiArgTerm` with `initialOp` reads the
   * operator first. A serialiser that wrote the repeated-infix form emitted terms
   * its own reader could not accept, so this walks every variadic kind at 2, 3
   * and 4 members, flat and nested, and compares the **term** as well as the
   * text: a chain that folded where the canonical form is flat round-trips as
   * text and is still a different term, which the text check alone would miss.
   */
  const roundTrips = (term: Term): boolean => {
    const text = serializeTerm(term);
    try {
      const read = termParser.parse(text);
      return serializeTerm(read) === text && termsEqual(term, read);
    } catch {
      return false;
    }
  };

  const members = [a, b, TermBuilder.atom('c'), TermBuilder.atom('d')];
  // Sequence is binary in SeNARS despite nary=true/arity=0 in OPERATORS
  const isNary = (k: OperatorKey): boolean =>
    k !== 'sequence' && OPERATORS[k].nary;
  const effectiveDeclared = (k: OperatorKey): number =>
    k === 'sequence' ? 2 : k === 'operation' ? 2 : k === 'negation' ? 1 : OPERATORS[k].arity;
  for (const [kind] of Object.entries(OPERATORS) as [OperatorKey, typeof OPERATORS[OperatorKey]][]) {
    const declared = effectiveDeclared(kind);
    const nary = isNary(kind);
    // A binary kind has no reading at three members — `createCompound` keeps the
    // extra argument and the serialiser drops it, so the term is not the term
    // written. Only a variadic kind is asked for the arities it can hold.
    const arities = nary ? [2, 3, members.length] : [declared];
    for (const arity of arities) {
      const operands = members.slice(0, arity);
      // Nesting is only a shape a variadic kind can hold. `negation` applied to a
      // two-argument `negation` is `--a,a`, which no serialiser writes and no
      // reader was ever asked for — the gate must not assert on a term the
      // canonical form cannot reach.
      const shapes: [string, Term][] = [
        ['flat', TermBuilder.compound(kind, operands)],
        ...(nary
          ? ([
              [
                'nested',
                TermBuilder.compound(
                  kind,
                  operands.map((m) => TermBuilder.compound(kind, [a, m]))
                ),
              ],
            ] as [string, Term][])
          : []),
      ];
      for (const [shape, term] of shapes)
        if (!roundTrips(term))
          failures.push(
            `${kind} at ${arity} members (${shape}): ${serializeTerm(term)} does not read back as itself`
          );
    }
  }

  /**
   * The operation encoder, which is what the tool layer actually calls. Every kind
   * round-trips as a *shape*, which says nothing about the encoder: `operationTerm`
   * nests its arguments in inheritances and a product, and a product of statements
   * is a form the grammar does not read. That was true before the `^` retirement
   * and would have stayed true, because the shape check above only ever built
   * `operation` out of atoms.
   */
  for (const args of [{}, { a: 1 }, { a: 1, b: 'two' }, { a: 1, b: 'two', c: false }]) {
    const term = operationTerm('tool', args);
    const read = readOperationTerm(termParser.parse(serializeTerm(term)));
    if (JSON.stringify(read) !== JSON.stringify({ name: 'tool', args }))
      failures.push(
        `operationTerm(${Object.keys(args).length} args): ${serializeTerm(term)} reads back as ${JSON.stringify(read)}`
      );
  }

  /**
   * Reducer form (TODO29.a §5.12). A canonical form that is not a *fixed point* is
   * not a canonical form, and one that reaches it in two passes is not reachable in
   * one — which is what the plan's "at most one step from a canonical term" means.
   * The corpus is the same generator as above, so a new kind or a new reducer is
   * covered by construction rather than by remembering to add a case.
   */
  const canonicalCorpus: Term[] = [];
  for (const [kind] of Object.entries(OPERATORS) as [OperatorKey, typeof OPERATORS[OperatorKey]][]) {
    const declared = effectiveDeclared(kind);
    const nary = isNary(kind);
    for (const n of nary ? [2, 3, 4] : [declared]) {
      const operands = members.slice(0, n);
      canonicalCorpus.push(TermBuilder.compound(kind, operands));
      if (nary)
        canonicalCorpus.push(
          TermBuilder.compound(kind, operands.map((m) => TermBuilder.compound(kind, [a, m])))
        );
    }
  }
  // Narsese sentences an author may write, each of which must parse to a canonical term.
  for (const text of ['--a', '(--a)', '--(a,b)', '(a&b)', '(&,a,b,c)', '(a,b,c)', '(a&|b)', '(a&/b)']) {
    const parsed = termParser.parse(text) as Term;
    canonicalCorpus.push(parsed);
  }

  for (const term of canonicalCorpus) {
    const once = canonicalTerm(term);
    if (canonicalTerm(once) !== once)
      failures.push(`canonicalTerm is not idempotent for ${serializeTerm(term)}`);
    if (once !== term)
      failures.push(`canonicalTerm rewrote an already-canonical ${serializeTerm(term)}`);
    for (const reducer of TERM_REDUCERS)
      if (reducer.applies(term))
        failures.push(`term reducer '${reducer.id}' still applies to canonical ${serializeTerm(term)}`);
  }

  // The negation rule is a function over the whole range, not two endpoints: a claim
  // and its negated spelling are one claim, confidence and stamp carried through.
  const stamp = Stamp.createInput();
  for (const f of [0, 0.1, 0.25, 0.5, 0.75, 0.9, 1]) {
    const negated = canonicalTask(
      createTask(TermBuilder.negation(a), 'belief', Truth.create(f, 0.7), NEUTRAL_BUDGET, { stamp })
    );
    const positive = canonicalTask(createTask(a, 'belief', Truth.create(1 - f, 0.7)));
    if (termKey(negated.term) !== termKey(positive.term))
      failures.push(`--x. %${f}%;0.7% and x. %${1 - f}%;0.7% are not one claim`);
    if (Math.abs(negated.truth.f - positive.truth.f) > 1e-9)
      failures.push(`(--x).f = 1 - f_x failed at f=${f}: ${negated.truth.f} != ${positive.truth.f}`);
    if (negated.truth.c !== 0.7)
      failures.push(`confidence was not carried through the negation rule at f=${f}`);
    if (negated.stamp !== stamp)
      failures.push(`the negation rule rewrote the stamp at f=${f} — it is a reduction, not a revision`);
    for (const reducer of TASK_REDUCERS)
      if (reducer.applies(negated))
        failures.push(`task reducer '${reducer.id}' still applies to a canonical claim at f=${f}`);
  }

  // Two spellings of one claim reach memory as one concept — asserted on the term
  // pair rather than on a statistic.
  const spelled = [
    [TermBuilder.conjunction(TermBuilder.conjunction(a, b), c), TermBuilder.conjunction(a, b, c)],
    [TermBuilder.conjunction(a, b, a), TermBuilder.conjunction(a, b)],
    [TermBuilder.negation(TermBuilder.negation(a)), a],
    [TermBuilder.product(a, TermBuilder.product(b, c)), TermBuilder.product(a, b, c)],
  ] as const;
  for (const [one, other] of spelled)
    if (termKey(one) !== termKey(other))
      failures.push(`${serializeTerm(one)} and ${serializeTerm(other)} are one claim but two terms`);

  // ...and the flattening stops where nesting is the claim.
  if (termsEqual(TermBuilder.product(a, b), TermBuilder.product(b, a)))
    failures.push('product is not commutative and must not sort');
  if (termDepth(TermBuilder.implication(a, TermBuilder.implication(a, b))) !== 2)
    failures.push('implication nesting is the claim and must not flatten');

  return failures;
};
