export {
  atomicSymbols,
  atomKey,
  containsSubterm,
  foldTerm,
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
  isNegation,
  isOperation,
  isSimilarity,
  mentionsSymbol,
  sameKind,
  sharesSymbol,
  termDepth,
  termKey,
  termSize,
  termsEqual,
  visitTerms,
  walkTerms,
} from './impls/accessors.js';
export { getTermComplexity } from './impls/complexity.js';
export { atom, TermBuilder, TermFactory } from './impls/factory.js';
export { normalize } from './impls/normalize.js';
export type { OperationCall } from './impls/operation-term.js';
export { operationTerm, readOperationTerm } from './impls/operation-term.js';
export type { ParserResult, ParseTaskResult, TaskTypeName } from './impls/parser-peggy.js';
export {
  ParseError,
  PUNCTUATION_BY_TASK_TYPE,
  TermParser,
  taskTypeForPunctuation,
  termParser,
} from './impls/parser-peggy.js';
export type { SerializedStamp, Source, Stamp as StampType } from './impls/Stamp.js';
export { deserializeStamp, observeStampId, Stamp, serializeStamp } from './impls/Stamp.js';
export { deserializeTerm, fromNarsese, serializeTerm, toNarsese } from './impls/serialize.js';
export { substituteVariables } from './impls/substitute.js';
export type { Truth as TruthType } from './impls/Truth.js';
export { isTruthEqual, Truth } from './impls/Truth.js';
export { TermCollection } from './impls/term-collection.js';
export { parseTermToEdges, type TermEdge } from './impls/term-edges.js';
export { TermMap } from './impls/term-map.js';
export { TermSet } from './impls/term-set.js';
export type { Substitution } from './impls/unifier.js';
export { unify } from './impls/unifier.js';
export { calculateSimilarity } from './impls/utils.js';
export { isInvalidTaskTerm, isTautology, validateTaskTerm } from './impls/validation.js';
export {
  INVALID_ATOM_CHARS_REGEX,
  isValidAtomSymbol,
  toAtomSymbol,
  VALID_ATOM_CHARS,
} from './impls/valid-atom.js';
export type { AtomicTerm, CompoundTerm, OperatorKey, OperatorSymbol, Term } from './types.js';
export {
  getTermArg,
  getTermArgs,
  isAtomic,
  isCompound,
  isVariableSymbol,
  OPERATORS,
} from './types.js';
