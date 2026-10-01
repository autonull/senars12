/**
 * The operation-term convention — one encoder, one decoder, one spelling.
 *
 * An operation is the `operation` kind, so `move(dir-->left,steps-->3)` is a term
 * like any other and the grammar reads it back without a special case. Its
 * arguments are a product, so `move()` is the 0-ary product rather than a
 * sentinel atom, and `(move^(x,y))` and `move(x,y)` are the same term.
 *
 * What this replaces was a second spelling for one idea: `^move(args)` decoded to
 * `Inheritance(Product(args), Atom('^move'))`, which no reader of an `operation`
 * term could see. Every recogniser of a tool goal therefore sniffed a predicate
 * atom's sigil, in six files, and each could disagree with the next. `^move` is
 * now a parse error and a term's `kind` is the recogniser.
 */

import { isAtomic, isCompound, type Term } from '../types.js';
import { termsEqual } from './accessors.js';
import { TermBuilder } from './factory.js';
import { isValidAtomSymbol, toAtomSymbol } from './valid-atom.js';

/** No arguments is the 0-ary product, which is what the factory makes of `product()`. */
const NO_ARGS = TermBuilder.product();

/** An operation term read back into the name and arguments a tool receives. */
export interface OperationCall {
  readonly name: string;
  readonly args: Record<string, unknown>;
}

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
 * `(move^(dir-->left,steps-->3))`. Keys are read in insertion order, so the
 * encoder is deterministic and the decoder reproduces it.
 */
export const operationTerm = (name: string, args: Readonly<Record<string, unknown>> = {}): Term => {
  const argTerms = Object.entries(args).map(([key, value]) => argTerm(key, value));
  return TermBuilder.operation(atomOf(name), TermBuilder.product(...argTerms));
};

/** The operation a term names, or `undefined` when it names none. */
export const operationNameOf = (term: Term): string | undefined => {
  if (!isCompound(term) || term.kind !== 'operation') return undefined;
  const name = term.args?.[0];
  return name && isAtomic(name) ? name.symbol : undefined;
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

const argEntriesOf = (args: Term | undefined): [string, unknown][] => {
  if (!args || termsEqual(args, NO_ARGS)) return [];
  if (isCompound(args) && args.kind === 'product') {
    return (args.args ?? []).map(argEntry);
  }
  return [argEntry(args, 0)];
};

/** The name and arguments a term calls, or `undefined` when it calls nothing. */
export const readOperationTerm = (term: Term): OperationCall | undefined => {
  const name = operationNameOf(term);
  if (name === undefined) return undefined;
  return { name, args: Object.fromEntries(argEntriesOf(term.args?.[1])) };
};
