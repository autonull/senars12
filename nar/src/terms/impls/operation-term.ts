/**
 * The `^tool(args...)` operation-term convention — one encoder, one decoder.
 *
 * A tool goal is `Inheritance(Product(args...), Atom('^toolName'))`, where each
 * argument is `Inheritance(value, key)` so the pair survives the round trip
 * through Narsese. This module is the whole convention; the pieces that used to
 * spell it out separately disagreed with each other:
 *
 *  - `rl/impls/adapters/action` and `rules/impls/meta-rules` each built the
 *    inheritance form, with different empty-argument atoms (`true` vs `*`).
 *  - `gates/tasks.actionTerm` built an `Operation(...)` term instead, which no
 *    reader of this convention could decode.
 *  - `tools/impls/goal` read arguments back as a key/value record while
 *    `tick/bindings.operationActionOf` read the same term back as
 *    `{ args: string[] }` — and handed that straight to `tools.execute`.
 *
 * Read through {@link readOperationTerm} and built through
 * {@link operationTerm}, the two can no longer drift.
 */

import { isAtomic, isCompound, type Term } from '../types.js';
import { TermBuilder } from './factory.js';
import { isValidAtomSymbol, toAtomSymbol } from './valid-atom.js';

/** The mark that distinguishes an operation atom from an ordinary one. */
const OPERATION_MARK = '^';

/** No arguments is `true` — the empty product's identity, and what a bare tool name decodes to. */
const EMPTY_ARGS = 'true';

/** An operation term read back into the name and arguments a tool receives. */
export interface OperationCall {
  readonly name: string;
  readonly args: Record<string, unknown>;
}

/**
 * A key is always written as itself; a value is coerced only when the grammar
 * would refuse it. An atom may hold `^` and alphanumerics, so a tool argument
 * like `left: true` becomes `left_true` rather than throwing at the gate.
 */
/**
 * A quoted atom is how a value with punctuation in it stays one atom, so the
 * quote is checked before sanitising — otherwise `"hi"` would arrive as `_hi_`.
 */
const isQuoted = (symbol: string): boolean =>
  symbol.length > 1 && symbol.startsWith('"') && symbol.endsWith('"');

const atomOf = (text: unknown): Term => {
  const symbol = String(text);
  return TermBuilder.atom(
    isValidAtomSymbol(symbol) || isQuoted(symbol) ? symbol : toAtomSymbol(symbol)
  );
};

const argTerm = (key: string, value: unknown): Term =>
  TermBuilder.inheritance(atomOf(value), atomOf(key)) ??
  TermBuilder.product(atomOf(value), atomOf(key));

/**
 * `^toolName(key --> value, ...)`. Keys are read in insertion order, so the
 * encoder is deterministic and the decoder reproduces it.
 */
export const operationTerm = (name: string, args: Readonly<Record<string, unknown>> = {}): Term => {
  const entries = Object.entries(args);
  const argTerms = entries.map(([key, value]) => argTerm(key, value));
  const subject =
    argTerms.length === 0
      ? TermBuilder.atom(EMPTY_ARGS)
      : argTerms.length === 1
        ? argTerms[0]!
        : TermBuilder.product(...argTerms);
  const result = TermBuilder.inheritance(subject, atomOf(`${OPERATION_MARK}${name}`));
  if (!result) throw new Error(`Cannot build an operation term for ${name}`);
  return result;
};

/** An atom decodes to the primitive it was written from, not to its text. */
const atomValue = (symbol: string): unknown => {
  if (/^\d+$/.test(symbol)) return Number.parseInt(symbol, 10);
  if (/^\d+\.\d+$/.test(symbol)) return Number.parseFloat(symbol);
  if (symbol === 'true') return true;
  if (symbol === 'false') return false;
  const quoted =
    symbol.startsWith('"') && symbol.endsWith('"')
      ? symbol.slice(1, -1)
      : symbol.startsWith("'") && symbol.endsWith("'")
        ? symbol.slice(1, -1)
        : null;
  return quoted ?? symbol;
};

const termValue = (term: Term): unknown =>
  isAtomic(term) ? atomValue(term.symbol) : (term.args?.map(termValue) ?? term.toString());

/** `{key --> value}` decodes as `{key: value}`; anything else is a positional argument. */
const argEntry = (term: Term, index: number): [string, unknown] => {
  if (isCompound(term) && term.kind === 'inheritance') {
    const [value, key] = term.args ?? [];
    if (key && value && isAtomic(key)) return [key.symbol, termValue(value)];
  }
  return [`arg${index}`, termValue(term)];
};

const argEntriesOf = (subject: Term | undefined): [string, unknown][] => {
  if (!subject) return [];
  if (isCompound(subject) && subject.kind === 'product') {
    return (subject.args ?? []).map(argEntry);
  }
  const first = argEntry(subject, 0);
  return isAtomic(subject) && subject.symbol === EMPTY_ARGS ? [] : [first];
};

/**
 * The operation a term names, or `undefined` when it names none. Accepts the
 * bare `^name` atom, so an arm selector's action term reads as itself.
 */
export const readOperationTerm = (term: Term): OperationCall | undefined => {
  if (isAtomic(term)) {
    return term.symbol.startsWith(OPERATION_MARK)
      ? { name: term.symbol.slice(OPERATION_MARK.length), args: {} }
      : undefined;
  }
  if (!isCompound(term) || term.kind !== 'inheritance') return undefined;
  const [subject, predicate] = term.args ?? [];
  if (!predicate || !isAtomic(predicate) || !predicate.symbol.startsWith(OPERATION_MARK)) {
    return undefined;
  }
  return {
    name: predicate.symbol.slice(OPERATION_MARK.length),
    args: Object.fromEntries(argEntriesOf(subject)),
  };
};
