/**
 * Term types and operators
 * Defines the structure of terms in NARS12
 *
 * This is the pure types module - all type definitions only.
 * For operations on terms, see:
 * - serialize.ts / deserialize.ts - String conversion
 * - complexity.ts - Complexity and similarity metrics
 * - substitute.ts - Variable substitution
 * - normalize.ts - Normalization utilities
 * - accessors.ts - Term accessors and type guards
 * - guards.ts - Additional type guards
 * - factory.ts - Term construction
 * - parser.ts - Term parsing
 */

import type {OperatorKey} from './operators.js';

export {OPERATORS, COMMUTATIVE_OPS, NARY_OPS} from './operators.js';
export type {OperatorKey, OperatorSymbol} from './operators.js';

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

export const isVariableSymbol = (symbol: string): boolean => symbol.startsWith('$');
export const isAtomic = (term: Term): term is AtomicTerm => term.kind === 'atom';
export const isCompound = (term: Term): term is CompoundTerm => term.kind !== 'atom';
export const getTermArgs = (term: Term): readonly Term[] | undefined => term.kind === 'atom' ? undefined : term.args;
export const getTermArg = (term: Term, index: number): Term | undefined => term.kind === 'atom' ? undefined : term.args?.[index];
