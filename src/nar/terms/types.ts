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

import {computeHash} from '../utils';
export {OPERATORS, COMMUTATIVE_OPS, NARY_OPS} from './operators.js';
export type {OperatorKey, OperatorSymbol} from './operators.js';

export interface AtomicTerm {
    readonly kind: 'atom';
    readonly symbol: string;
    readonly hash: number;
    readonly isVariable?: boolean;

    toString(): string;
}

export interface CompoundTerm<K extends OperatorKey = OperatorKey> {
  readonly kind: K;
  readonly args: Term[];
  readonly hash: number;

  toString(): string;
}

export type Term = AtomicTerm | CompoundTerm;
export type TermMap = Map<number, Term>;

// Re-export hash utilities
export {computeHash};

// Term type guards
export const isVariableSymbol = (symbol: string): boolean => symbol.startsWith('$');
export const isAtomic = (term: Term): term is AtomicTerm => term.kind === 'atom';
export const isCompound = (term: Term): term is CompoundTerm => term.kind !== 'atom';

// Term accessors
export const getTermArgs = (term: Term): Term[] =>
    term.kind === 'atom' ? [] : term.args;

export const getTermArg = (term: Term, index: number): Term | undefined =>
    term.kind === 'atom' ? undefined : term.args[index];

// Term equality
export {termsEqual} from './accessors.js';

// Note: For term construction, use TermBuilder from factory.ts directly

// Re-export from dedicated modules
export {serializeTerm, deserializeTerm} from './serialize.js';
export {getTermComplexity} from './complexity.js';
export {getTermSimilarity} from './similarity.js';
export {substituteVariables} from './substitute.js';
export {improveNormalization} from './normalize.js';
