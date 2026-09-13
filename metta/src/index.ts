export { Cache, type CacheOptions, type CacheStats, type EvictionPolicy } from './core/cache.js';
export { Concept, ConceptBag } from './core/concept-bag.js';
export { createConfig, type MeTTaConfig, presets } from './core/config.js';
export { ErrorCode, MeTTaError } from './core/errors.js';
export { equalAtoms, hashAtom } from './core/hash.js';
export { type InternOptions, SymbolInterner } from './core/intern.js';
export { clearOps, defineOp, type GroundedOp, getOp, hasOp, registerOp } from './core/ops.js';
export { InMemorySpace } from './core/space.js';
export { Stamp } from './core/stamp.js';
export { EGraph, type RewriteRule } from './engine/egraph.js';
export { MeTTaInterpreter } from './engine/interpreter.js';
export { PatternMatcher } from './engine/match.js';
export { ReductionPipeline } from './engine/reduce.js';
export { applySubst, type Substitution, unify } from './engine/unify.js';
export {
  type PersistedSpaceData,
  PersistentSpace,
  type PersistentSpaceOptions,
} from './extensions/persistent-space.js';
export type { IPCMessage } from './ipc/protocol.js';
export { deserialize, serialize } from './ipc/protocol.js';
export { SharedMemoryQueue } from './ipc/shared-memory.js';
export { parseMeTTa } from './parser/runtime.js';
export { globalJIT, JITCompiler } from './performance/jit.js';
export type { ParallelOptions } from './performance/parallel.js';
export { parallelMap, parallelReduce } from './performance/parallel.js';
export { createMeTTa, MeTTaBuilder, MeTTaRuntime } from './runtime/builder.js';
export type { MeTTaContext } from './runtime/context.js';
export { bootstrapStdLib } from './stdlib/index.js';
export type {
  ExpressionAtom,
  GroundedAtom,
  MeTTaAtom,
  NumberAtom,
  StringAtom,
  SymbolAtom,
  VariableAtom,
} from './types/ast.js';
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
} from './types/ast.js';
export {
  composeSubst,
  freshType,
  occursCheck,
  resetTypeIds,
  TypeChecker,
  unifyTypes,
} from './types/inference.js';
export type { ImmutableSpace, MeTTaSpace } from './types/space.js';
export type {
  Keyword,
  OperationName,
  TypeName,
  ValidateAtomType,
  VariableName,
} from './types/syntax.js';
export type { Subst, Type, TypeCon, TypeEnv, TypeFun, TypeScheme, TypeVar } from './types/type.js';
export {
  isTypeCon,
  isTypeFun,
  isTypeVar,
  TypeKind,
  typecon,
  typefun,
  typevar,
} from './types/type.js';
