export type { BareInheritance, BinaryKind, TermPair, UnaryKind } from './impls/accessors';
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
} from './impls/accessors';
export { getTermComplexity } from './impls/complexity';
export { atom, TermBuilder, TermFactory } from './impls/factory';
export { canonicalTerm, type TermReducer, TERM_REDUCERS } from './reduce';
export { canonicalTask, type TaskReducer, TASK_REDUCERS } from './reduce-task';
export type { OperationCall } from './impls/operation-term';
export { operationNameOf, operationTerm, readOperationTerm } from './impls/operation-term';
export type { ParserResult, ParseTaskResult, TaskTypeName } from './impls/parser-peggy';
export {
  deserializeTerm,
  fromNarsese,
  parseTaskTolerant,
  ParseError,
  PUNCTUATION_BY_TASK_TYPE,
  TermParser,
  taskTypeForPunctuation,
  termParser,
} from './impls/parser-peggy';
export type { SerializedStamp, Source, Stamp as StampType } from './impls/Stamp';
export { deserializeStamp, observeStampId, Stamp, serializeStamp } from './impls/Stamp';
export { serializeTerm, toNarsese } from './impls/serialize';
export type { Truth as TruthType } from './impls/Truth';
export { isTruthEqual, Truth } from './impls/Truth';
export { TermCollection } from './impls/term-collection';
export { parseTermToEdges, type TermEdge } from './impls/term-edges';
export type { TermMapEntry } from './impls/term-map';
export { TermMap } from './impls/term-map';
export { TermSet } from './impls/term-set';
export type { Substitution } from './impls/unifier';
export { applySubstitution, unify } from './impls/unifier';
export { calculateSimilarity } from './impls/utils';
export {
  INVALID_ATOM_CHARS_REGEX,
  isValidAtomSymbol,
  toAtomSymbol,
  VALID_ATOM_CHARS,
} from './impls/valid-atom';
export { isInvalidTaskTerm, isTautology, validateTaskTerm } from './impls/validation';
export type { AtomicTerm, CompoundTerm, OperatorKey, OperatorSymbol, Term } from './types';
export {
  COPULA_SYMBOLS,
  hasCopula,
  isAtomic,
  isCompound,
  isVariableSymbol,
  OPERATORS,
} from './types';
