// Core types
export type { AtomicTerm, CompoundTerm, OperatorKey, OperatorSymbol, Term } from './types.js';
export {
  getTermArg,
  getTermArgs,
  isAtomic,
  isCompound,
  isVariableSymbol,
  OPERATORS,
} from './types.js';

// Utilities
import { trackTerm } from '../memory';

// Accessors
export {
  containsSubterm,
  getAntecedent,
  getArgs,
  getConsequent,
  getPredicate,
  getSubject,
  isConjunction,
  isDisjunction,
  isEquivalence,
  isImplication,
  isInheritance,
  isInstance,
  isNegation,
  isOperation,
  isParallel,
  isPredictive,
  isProperty,
  isRetrospective,
  isSequence,
  isSimilarity,
  mentionsSymbol,
  sameKind,
  sharesSymbol,
  termsEqual,
  visitTerms,
} from './accessors.js';
// Complexity and similarity
export { getTermComplexity } from './complexity.js';
// Convenience export for atom function
export { atom, freeze, TermBuilder, TermFactory } from './factory.js';
export type { TermVisitorFn } from './normalize.js';
// Normalization
export { normalize } from './normalize.js';
export type { ParserResult, ParseTaskResult, TaskTypeName } from './parser-peggy.js';
export { ParseError, TermParser, termParser } from './parser-peggy.js';
// Serialization
export { deserializeTerm, fromNarsese, serializeTerm, toNarsese } from './serialize.js';
export { getTermSimilarity } from './similarity.js';
export type { Source, Stamp as StampType } from './stamp.js';
export { Stamp } from './stamp.js';
// Variable substitution
export { substituteVariables } from './substitute.js';
// Term-based collections
export { TermCollection } from './term-collection.js';
// Term edges
export { parseTermToEdges, type TermEdge } from './term-edges.js';
export { TermMap } from './term-map.js';
export { TermSet } from './term-set.js';
export type { Truth as TruthType } from './truth.js';
// Truth and stamp systems
export { isTruthEqual, Truth } from './truth.js';
export type { Substitution } from './unifier.js';
// Unification
export { unify } from './unifier.js';

// Utilities
export { calculateSimilarity, extractSymbols } from './utils.js';

// Validation
export { isInvalidTaskTerm, isTautology, validateTaskTerm } from './validation.js';
export { trackTerm };
