/**
 * MeTTa — MeTTa port and agent (migrated from @senars/metta and @senars/agent).
 */

export {
  Concept,
  ConceptBag,
} from './core/concept-bag';
export {
  createConfig,
  type MeTTaConfig,
  presets,
} from './core/config';
export {
  MeTTaError,
  MeTTaReason,
} from './core/errors';
export {
  atomKey,
  equalAtoms,
  hashAtom,
} from './core/hash';
export {
  clearOps,
  defineOp,
  type GroundedOp,
  getOp,
  hasOp,
  registerOp,
} from './core/ops';
export {
  InMemorySpace,
} from './core/space';
export {
  Stamp as MettaStamp,
} from './core/stamp';
export {
  EGraph,
  type RewriteRule,
} from './engine/egraph';
export {
  MettaEngine,
} from './engine/MettaEngine';
export {
  MeTTaInterpreter,
} from './engine/interpreter';
export {
  PatternMatcher,
} from './engine/match';
export {
  ReductionPipeline,
} from './engine/reduce';
export {
  applySubst,
  type Substitution,
  unify,
} from './engine/unify';
export {
  type PersistedSpaceData,
  PersistentSpace,
  type PersistentSpaceOptions,
} from './extensions/persistent-space';
export type {
  IPCMessage,
} from './ipc/protocol';
export {
  deserialize,
  serialize,
} from './ipc/protocol';
export {
  SharedMemoryQueue,
} from './ipc/shared-memory';
export {
  globalJIT,
  JITCompiler,
} from './performance/jit';
export type {
  ParallelOptions,
} from './performance/parallel';
export {
  parallelMap,
  parallelReduce,
} from './performance/parallel';
export {
  createMeTTa,
  MeTTaBuilder,
  MeTTaRuntime,
  createMeTTa as createMetta,
} from './runtime/builder';
export { parseMeTTa, parseMeTTa as parseMetta } from './parser/runtime';
export type {
  MeTTaContext,
} from './runtime/context';
export {
  bootstrapStdLib,
} from './stdlib/index';
export type {
  ExpressionAtom,
  GroundedAtom,
  MeTTaAtom,
  NumberAtom,
  StringAtom,
  SymbolAtom,
  VariableAtom,
} from './types/ast';
export {
  AtomKind,
  expr,
  isExpression,
  isGrounded,
  isNumber,
  isString,
  isSymbol,
  isVariable,
  num,
  str,
  sym,
  varr,
} from './types/ast';
export {
  composeSubst,
  freshType,
  occursCheck,
  resetTypeIds,
  TypeChecker,
  unifyTypes,
} from './types/inference';
export type {
  ImmutableSpace,
  MeTTaSpace,
} from './types/space';
export type {
  Keyword,
  OperationName,
  TypeName,
  ValidateAtomType,
  VariableName,
} from './types/syntax';
export type {
  Subst,
  Type,
  TypeCon,
  TypeEnv,
  TypeFun,
  TypeScheme,
  TypeVar,
} from './types/type';
export {
  isTypeCon,
  isTypeFun,
  isTypeVar,
  TypeKind,
  typecon,
  typefun,
  typevar,
} from './types/type';
export type { MettaPort } from '@senars/agent';
export { createMettaPort } from './agent/index';