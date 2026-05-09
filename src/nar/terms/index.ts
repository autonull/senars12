// Core types
export type {Term, AtomicTerm, CompoundTerm, OperatorKey, OperatorSymbol} from './types.js';
export {
    OPERATORS,
    isVariableSymbol,
    isAtomic,
    isCompound,
    getTermArgs,
    getTermArg,
    atom,
    serializeTerm
} from './types.js';

// Builder and factory
export {TermBuilder, freeze} from './factory.js';

// Truth and stamp systems
export {Truth, isTruthEqual} from './truth.js';
export type {Truth as TruthType} from './truth.js';
export {Stamp, MAX_DEPTH} from './stamp.js';
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
  termKey,
  isCanonical,
  getArgsSafe,
  getCompoundArgs,
  sameHash,
  sameTerm
} from './guards.js';