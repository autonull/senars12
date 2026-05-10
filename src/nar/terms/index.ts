// Core types
export type {Term, AtomicTerm, CompoundTerm, OperatorKey, OperatorSymbol} from './types.js';
export { OPERATORS, isVariableSymbol, isAtomic, isCompound, getTermArgs, getTermArg } from './types.js';

// Builder and factory
import {TermBuilder} from './factory.js';
export {TermBuilder, freeze, TermFactory} from './factory.js';
// Convenience export for atom function
export const atom = TermBuilder.atom;

// Serialization
export {serializeTerm, deserializeTerm} from './serialize.js';

// Complexity and similarity
export {getTermComplexity} from './complexity.js';
export {getTermSimilarity} from './similarity.js';

// Variable substitution
export {substituteVariables} from './substitute.js';

// Truth and stamp systems
export {Truth, isTruthEqual} from './truth.js';
export type {Truth as TruthType} from './truth.js';
export {Stamp} from './stamp.js';
export type {Stamp as StampType, Source} from './stamp.js';

// Normalization
export {normalize, visit, reduce, getTermDepth, getTermSize} from './normalize.js';
export type {TermVisitorFn} from './normalize.js';

// Caching
export {TermCache} from './cache.js';

// Unification
export {unify} from './unifier.js';
export type {Substitution} from './unifier.js';
export {termParser, TermParser} from './parser.js';

// Accessors - named exports only
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
  sameKind
} from './accessors.js';

// Utilities
export {extractSymbols, getTermHash} from './utils.js';

// Type guards and helpers
export {
  termHashKey,
  isCanonical,
  getCompoundArgs
} from './guards.js';