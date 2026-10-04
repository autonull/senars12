/**
 * Term types and operators
 * Defines the structure of terms in NARS12
 *
 * This is the pure types module - all type definitions only.
 * For operations on terms, see:
 * - serialize.ts / deserialize.ts - String conversion
 * - complexity.ts - Complexity and similarity metrics
 * - substitute.ts - Variable substitution
 * - accessors.ts - Term accessors and type guards
 * - guards.ts - Additional type guards
 * - factory.ts - Term construction
 * - parser.ts - Term parsing
 */

import type { OperatorKey } from './operators.js';

export type { OperatorKey, OperatorSymbol } from './operators.js';
export { COMMUTATIVE_OPS, COPULA_SYMBOLS, hasCopula, NARY_OPS, OPERATORS } from './operators.js';

export interface AtomicTerm {
  readonly kind: 'atom';
  readonly symbol: string;
  readonly isVariable?: boolean;
  readonly args?: never;

  toString(): string;
}

export interface CompoundTerm<K extends OperatorKey = OperatorKey> {
  readonly kind: K;
  readonly args: readonly Term[];
  readonly symbol?: never;

  toString(): string;
}

export type Term = AtomicTerm | CompoundTerm;

/**
 * Narsese variable sigils. This is the single definition: the atom factory
 * stamps `isVariable` from it, and every variable test — rules, complexity,
 * substitution, the unifier — agrees with it. Two of those read the stamped
 * flag rather than this regex, so they hold only while every atom came from the
 * factory; {@link isVariableSymbol} is the form to reach for when that is not
 * guaranteed. The unifier previously used a `$`-only test while the factory
 * accepted all five, so `atom('?x')` was built as a variable that the unifier
 * then refused to bind.
 */
export const VARIABLE_SYMBOL = /^[?$#*%]/;

export const isVariableSymbol = (symbol: string): boolean => VARIABLE_SYMBOL.test(symbol);
export const isAtomic = (term: Term): term is AtomicTerm => term.kind === 'atom';
export const isCompound = (term: Term): term is CompoundTerm => term.kind !== 'atom';
export const getTermArgs = (term: Term): readonly Term[] | undefined =>
  term.kind === 'atom' ? undefined : term.args;
export const getTermArg = (term: Term, index: number): Term | undefined =>
  term.kind === 'atom' ? undefined : term.args?.[index];
