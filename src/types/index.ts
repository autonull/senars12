export type { Source, Stamp } from '../terms/impls/Stamp.js';
export type { Truth as TruthType } from '../terms/impls/Truth.js';
export type { AtomicTerm, CompoundTerm, Term } from '../terms/types.js';
export type { Engine, EngineId } from './engine.js';
export type { CognitiveStimulus, Context, Derivation } from './cognitive.js';
export type { ToolResult } from './engine.js';
export { toolOk, toolError } from './engine.js';
export type { BaseComponent } from './lifecycle.js';
export type {
  BaseStats,
  Budget,
  ConceptLike,
  CoreConfig,
  Duration,
  Hash,
  Nullable,
  Optional,
  QueryOptions,
  Task,
  TaskType,
  TermFilter,
  TermSymbol,
  Timestamp,
  TruthFilter,
} from './core.js';
export {
  createBeliefTask,
  createTaskWeight,
  createDuration,
  createSecondaryTask,
  createTask,
  createTimestamp,
  DEFAULT_CONFIG,
  DEPTH_MAX,
  NEUTRAL_BUDGET,
} from './core.js';
export type { EventMap, EventReceiver, EventUnsubscribe, NAREventMap } from './events.js';
export { NarEventBus } from './events.js';

// Re-export utility types/functions from @senars/util (single source of truth)
export type {
  Err,
  Ok,
  Result,
} from '@senars/util/result';
export {
  attempt,
  attemptAsync,
  err,
  flatMap,
  getOrElse,
  isErr,
  isOk,
  map,
  ok,
  unwrapOrThrow,
} from '@senars/util/result';
export {
  ConfigurationError,
  OperationError,
  ToolError,
  ValidationError,
} from '@senars/errors';

export { MESSAGE_ROLES, MessageRoleSchema, type MessageRole, HistoryEntrySchema, type HistoryEntry, type ConversationSession, type SessionManager } from './memory.js';
