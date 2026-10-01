#!/usr/bin/env tsx

/**
 * `terms:canonical` — the operator table, the grammar and the serialiser agree,
 * and every kind survives the round trip (TODO29.a §5.12 step 1).
 *
 * Six of sixteen kinds could not be read back from their own output: the
 * serialiser wrote `=>`, `||`, `/>` and `/<` where Narsese writes `==>`, `&|`,
 * `=/>` and `=|`; `{a}` and `[a]` were built as kinds the grammar never names;
 * and the comma copula built a conjunction, so no product had a text syntax at
 * all. The round-trip property test saw none of it, because it enumerated the
 * five kinds that worked.
 *
 * Three rules, and each is a place the two tables could drift apart:
 *
 * 1. **every kind round-trips** — `serialize → parse` is identity, over a
 *    generator derived from `OPERATORS` rather than from a list of what passes;
 * 2. **the grammar names no kind the table lacks** — `INFIX_KINDS` is the only
 *    place a symbol can become a kind, and an unmapped operator used to fall
 *    through to `create(op)` and build a term whose `kind` was the symbol;
 * 3. **every table symbol is in the grammar's token list** — or is one of the
 *    wrapper symbols (`{`, `[`, `--`) and the argument separator (`,`).
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { TermBuilder } from '../nar/src/terms/impls/factory.js';
import { operationTerm, readOperationTerm } from '../nar/src/terms/impls/operation-term.js';
import { termParser } from '../nar/src/terms/impls/parser-peggy.js';
import { serializeTerm } from '../nar/src/terms/impls/serialize.js';
import { OPERATORS } from '../nar/src/terms/operators.js';
import { ROOT } from './lib/root.js';

const GRAMMAR = readFileSync(join(ROOT, 'nar/src/terms/narsese.peggy'), 'utf8');
const WRAPPER_SYMBOLS = new Set(['{', '[', '--']);

const failures: string[] = [];

const declaredKinds = (name: string): Map<string, string> => {
  const source = GRAMMAR.match(new RegExp(`const ${name} = \\{([^}]*)\\}`))?.[1] ?? '';
  return new Map(
    [...source.matchAll(/'([^']+)'\s*:\s*'([^']+)'/g)].map(([, symbol, kind]) => [symbol, kind])
  );
};

const grammarTokens = (): Set<string> =>
  new Set(
    [...(GRAMMAR.match(/^OperatorToken\b[\s\S]*?^$/m)?.[0] ?? '').matchAll(/"([^"]+)"/g)].map(
      ([, token]) => token
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
for (const [kind, { arity }] of Object.entries(OPERATORS)) {
  const term = TermBuilder.compound(kind, [a, b].slice(0, Math.max(arity, 1)));
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

if (failures.length > 0) {
  console.error(`terms:canonical — ${failures.length} failure(s)`);
  for (const failure of failures) console.error(`  ${failure}`);
  process.exit(1);
}

console.log(
  `terms:canonical — ${Object.keys(OPERATORS).length} kinds round-trip; grammar and operator table agree`
);
