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
import {TermBuilder} from './factory.js';

export const OPERATORS = {
  inheritance: '-->',
  similarity: '<->',
  conjunction: '&',
  disjunction: '|',
  negation: '--',
  implication: '=>',
  equivalence: '<=>',
  instance: '{',
  property: '[',
  sequence: ',/',
  parallel: '||',
  predictive: '/>',
  retrospective: '/<',
  operation: '^'
} as const;

export type OperatorKey = keyof typeof OPERATORS;
export type OperatorSymbol = typeof OPERATORS[OperatorKey];

export interface AtomicTerm {
    readonly kind: 'atom';
    readonly symbol: string;
    readonly hash: number;
    readonly isVariable?: boolean;

    toString(): string;
}

export interface CompoundTerm {
    readonly kind: OperatorKey;
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
export const termsEqual = (a: Term, b: Term): boolean => a.hash === b.hash;

// Lazy getter for atom to avoid circular dependency
export const atom = (symbol: string): AtomicTerm => TermBuilder.atom(symbol);

// Re-export from dedicated modules
export {serializeTerm, deserializeTerm} from './serialize.js';
export {getTermComplexity} from './complexity.js';
export {getTermSimilarity} from './similarity.js';
export {substituteVariables} from './substitute.js';
export {improveNormalization} from './normalize.js';
