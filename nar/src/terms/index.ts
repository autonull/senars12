// Core types
export type { Term, AtomicTerm, CompoundTerm, OperatorKey, OperatorSymbol } from './types.js';
export {
  OPERATORS,
  isVariableSymbol,
  isAtomic,
  isCompound,
  getTermArgs,
  getTermArg,
} from './types.js';

// Utilities
import { trackTerm } from '../memory';

export { trackTerm };

export { TermBuilder, freeze, TermFactory } from './factory.js';
// Convenience export for atom function
export { atom } from './factory.js';

// Serialization
export { serializeTerm, deserializeTerm, toNarsese, fromNarsese } from './serialize.js';

// Complexity and similarity
export { getTermComplexity } from './complexity.js';
export { getTermSimilarity } from './similarity.js';

// Variable substitution
export { substituteVariables } from './substitute.js';

// Truth and stamp systems
export { Truth, isTruthEqual } from './truth.js';
export type { Truth as TruthType } from './truth.js';
export { Stamp } from './stamp.js';
export type { Stamp as StampType, Source } from './stamp.js';

// Normalization
export { normalize } from './normalize.js';
export type { TermVisitorFn } from './normalize.js';

// Unification
export { unify } from './unifier.js';
export type { Substitution } from './unifier.js';
export { termParser, TermParser, ParseError } from './parser-peggy.js';
export type { ParserResult, ParseTaskResult, TaskTypeName } from './parser-peggy.js';

// Accessors
export {
  isInheritance,
  isSimilarity,
  isImplication,
  isEquivalence,
  isConjunction,
  isDisjunction,
  isNegation,
  isInstance,
  isProperty,
  isSequence,
  isParallel,
  isPredictive,
  isRetrospective,
  isOperation,
  getSubject,
  getPredicate,
  getAntecedent,
  getConsequent,
  getArgs,
  termsEqual,
  sameKind,
  visitTerms,
  containsSubterm,
  sharesSymbol,
  mentionsSymbol,
} from './accessors.js';

// Term-based collections
export { TermCollection } from './term-collection.js';
export { TermSet } from './term-set.js';
export { TermMap } from './term-map.js';

// Utilities
export { extractSymbols, calculateSimilarity } from './utils.js';

// Validation
export { isTautology, isInvalidTaskTerm, validateTaskTerm } from './validation.js';

// Term edges
export { parseTermToEdges, type TermEdge } from './term-edges.js';
