/**
 * Loop — the one cognitive loop.
 */

// Re-export types with explicit naming to avoid conflicts
export {
  createActionSelector,
  type ActionSelector,
  type SelectionContext,
  type SelectionResult,
  type SelectionCandidate,
  type SelectionEvidence,
  type SelectionRecord as SelectSelectionRecord,
  type SelectionOutcome,
  type SelectionMetadata,
  type SelectorConfig,
  type ScoredCandidate,
  SELECTION_STRATEGIES,
  type SelectionStrategy,
  defaultSelectorConfig,
} from './select.js';

export {
  type Action,
  type ActionType,
  type ActionStatus,
  type ActionPrecondition,
  type ActionEffect,
  type RetryPolicy,
  defaultRetryPolicy,
  ACTION_TYPES,
  ACTION_STATUS,
} from './act.js';

export {
  createLoopRecorder,
  type LoopRecorder,
  type LoopRecord,
  type IterationRecord as LoopIterationRecord,
  type SelectionRecord as RecordSelectionRecord,
  type ActionRecord,
  type JudgmentRecord,
  type OracleRecord,
  type ContractRecord,
  type RepairRecord,
  type AppraisalRecord,
  type RecordType,
  type RecordStoreConfig,
  type BaseRecord,
  RECORD_TYPES,
  defaultRecordStoreConfig,
  LoopRecordStore,
  createLoopRecordStore,
} from './record.js';

export * from './contract.js';
export * from './repair.js';
export * from './appraise.js';
export * from './self-model.js';

// Re-export loop types with explicit naming to avoid conflict with contract.js IterationResult
export { CognitiveLoop, createCognitiveLoop } from './loop.js';
export type {
  LoopConfig,
  IterationResult as LoopIterationResult,
  LoopContext,
  ActionResult,
  EffectResult,
  JudgmentResult,
  LoopEventType,
  LoopEvent,
  FacultyInvoker,
} from './types.js';

export { LOOP_EVENTS } from './types.js';

export {
  createLoopContext,
  initializeFacultyInvokers,
} from './context.js';

export {
  createLoopEventEmitter,
} from './events.js';

export {
  runIteration,
} from './iteration.js';

export {
  createSelfModelManager,
} from './self-model.js';