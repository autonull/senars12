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
} from './select';

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
} from './act';

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
} from './record';

export * from './contract';
export {
  CandidateSchema,
  JudgmentSchema,
  ConsequenceReportSchema,
  ConflictSchema,
  DiagnosticSchema,
  RepairRequestSchema,
  VerdictSchema,
  OutcomeSchema,
  LessonSchema,
  WorkItemSchema,
  IdSchema,
  TimestampSchema,
  TermRefSchema,
  TruthRefSchema,
  TaskBagKindSchema,
  TaskSourceSchema,
  CONTRACT_SCHEMAS,
  getContractSchema,
  validateContract,
  safeValidateContract,
} from './contracts/index';
export type {
  ContractType,
  AnyContract,
  Candidate,
  Judgment,
  ConsequenceReport,
  Conflict,
  Diagnostic,
  RepairRequest,
  Verdict,
  Outcome,
  Lesson,
  WorkItem,
} from './contracts/index';
export * from './repair';
export * from './appraise';
export * from './self-model';

// Re-export loop types with explicit naming to avoid conflict with contract.js IterationResult
export { CognitiveLoop, createCognitiveLoop } from './loop';
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
} from './types';

export { LOOP_EVENTS } from './types';

export {
  createLoopContext,
  initializeFacultyInvokers,
} from './context';

export {
  createLoopEventEmitter,
} from './events';

export {
  runIteration,
} from './iteration';

export {
  createSelfModelManager,
} from './self-model';

export {
  LoopLogAdapter,
  createLoopLogAdapter,
  wireLoopToLog,
} from './log-adapter';