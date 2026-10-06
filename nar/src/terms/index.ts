export type { BareInheritance, BinaryKind, TermPair, UnaryKind } from './impls/accessors.js';
export {
  atomicSymbols,
  atomicTerms,
  atomKey,
  bareInheritancePair,
  binaryOf,
  containsSubterm,
  foldTerm,
  getAntecedent,
  getArgs,
  getConsequent,
  getPredicate,
  getSubject,
  hasVariable,
  isConjunction,
  isDisjunction,
  isEquivalence,
  isImplication,
  isInheritance,
  isNegation,
  isOperation,
  isPredictive,
  isSequence,
  isSetExt,
  isSetInt,
  isSimilarity,
  mentionsSymbol,
  rolePair,
  sameKind,
  sharesInheritanceEnd,
  sharesSymbol,
  hasNegatedPair,
  hasRepeatedArgs,
  termDepth,
  termKey,
  termSize,
  unaryOf,
  termsEqual,
  visitTerms,
  walkTerms,
} from './impls/accessors.js';
export { getTermComplexity } from './impls/complexity.js';
export { atom, TermBuilder, TermFactory } from './impls/factory.js';
export { canonicalTerm, type TermReducer, TERM_REDUCERS } from './reduce.js';
export { canonicalTask, type TaskReducer, TASK_REDUCERS } from './reduce-task.js';
export type { OperationCall } from './impls/operation-term.js';
export { operationNameOf, operationTerm, readOperationTerm } from './impls/operation-term.js';
export type { ParserResult, ParseTaskResult, TaskTypeName } from './impls/parser-peggy.js';
export {
  deserializeTerm,
  fromNarsese,
  parseTaskTolerant,
  ParseError,
  PUNCTUATION_BY_TASK_TYPE,
  TermParser,
  taskTypeForPunctuation,
  termParser,
} from './impls/parser-peggy.js';
export type { SerializedStamp, Source, Stamp as StampType } from './impls/Stamp.js';
export { deserializeStamp, observeStampId, Stamp, serializeStamp } from './impls/Stamp.js';
export { serializeTerm, toNarsese } from './impls/serialize.js';
export type { Truth as TruthType } from './impls/Truth.js';
export { isTruthEqual, Truth } from './impls/Truth.js';
export { TermCollection } from './impls/term-collection.js';
export { parseTermToEdges, type TermEdge } from './impls/term-edges.js';
export type { TermMapEntry } from './impls/term-map.js';
export { TermMap } from './impls/term-map.js';
export { TermSet } from './impls/term-set.js';
export type { Substitution } from './impls/unifier.js';
export { applySubstitution, unify } from './impls/unifier.js';
export { calculateSimilarity } from './impls/utils.js';
export {
  INVALID_ATOM_CHARS_REGEX,
  isValidAtomSymbol,
  toAtomSymbol,
  VALID_ATOM_CHARS,
} from './impls/valid-atom.js';
export { isInvalidTaskTerm, isTautology, validateTaskTerm } from './impls/validation.js';
export type { AtomicTerm, CompoundTerm, OperatorKey, OperatorSymbol, Term } from './types.js';
export {
  COPULA_SYMBOLS,
  hasCopula,
  isAtomic,
  isCompound,
  isVariableSymbol,
  OPERATORS,
} from './types.js';
