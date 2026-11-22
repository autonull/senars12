/**
 * Loop Types — shared type definitions for the cognitive loop.
 */

import type { Economy, EconomyTask, EconomyScheduler, SchedulerResult, EconomyEvent, EconomyEventType } from '../economy/index';
import type { FacultyRegistry, FacultySpec, FacultyInput, FacultyOutput } from '../faculties/specs';
import type { OracleRegistry, Oracle, OracleInput, OracleOutput } from '../oracles/oracle';
import type { Term } from '../kernel/terms/term';
import type { Task } from '../kernel/types';
import type { Truth } from '../kernel/truth';
import type { Env } from '../kernel/env';
import type { LoopAppraisal } from './appraise';
import type { RepairLoop, RepairContext, RepairResult as LoopRepairResult } from './repair';
import type { ContractCheckResult, ContractContext } from './contract';
import type { SelectionResult, SelectionCandidate, SelectionContext, ActionSelector } from './select';
import type { ContractRegistry } from './contract';
import type { LoopRecorder } from './record';
import type { SelfModelManager } from './self-model';

/** Re-export commonly used types. */
export type {
  Economy,
  EconomyTask,
  EconomyScheduler,
  SchedulerResult,
  FacultyRegistry,
  FacultySpec,
  FacultyInput,
  FacultyOutput,
  OracleRegistry,
  Oracle,
  Term,
  Task,
  Truth,
  LoopAppraisal,
  RepairLoop,
  RepairContext,
  LoopRepairResult,
  ContractCheckResult,
  ContractContext,
  SelectionResult,
  SelectionCandidate,
  SelectionContext,
  ActionSelector,
  ContractRegistry,
  LoopRecorder,
  SelfModelManager,
};

/** Loop configuration. */
export interface LoopConfig {
  /** Maximum iterations. */
  maxIterations?: number;
  /** Iteration timeout (ms). */
  iterationTimeoutMs?: number;
  /** Enable recording. */
  recordEnabled?: boolean;
  /** Enable contracts. */
  contractsEnabled?: boolean;
  /** Enable repair. */
  repairEnabled?: boolean;
  /** Enable self-model. */
  selfModelEnabled?: boolean;
  /** Enable appraisal. */
  appraisalEnabled?: boolean;
  /** Correlation ID for tracing. */
  correlationId?: string;
}

/** Default loop config. */
export const defaultLoopConfig: LoopConfig = {
  maxIterations: 10000,
  iterationTimeoutMs: 5000,
  recordEnabled: true,
  contractsEnabled: true,
  repairEnabled: true,
  selfModelEnabled: true,
  appraisalEnabled: true,
};

/** Loop iteration result. */
export interface IterationResult {
  /** Iteration number. */
  iteration: number;
  /** Selected task. */
  selectedTask: EconomyTask | null;
  /** Selection result. */
  selection: SelectionResult;
  /** Action results. */
  actions: ActionResult[];
  /** Judgment results. */
  judgments: JudgmentResult[];
  /** Contract results. */
  contracts: ContractCheckResult[];
  /** Repair results. */
  repairs: LoopRepairResult[];
  /** Appraisal. */
  appraisal?: LoopAppraisal;
  /** Duration (ms). */
  durationMs: number;
  /** Success. */
  success: boolean;
  /** Error if failed. */
  error?: string;
}

/** Action execution result. */
export interface ActionResult {
  /** Action ID. */
  actionId: string;
  /** Task executed. */
  task: EconomyTask;
  /** Success. */
  success: boolean;
  /** Output. */
  output?: unknown;
  /** Effects applied. */
  effects: EffectResult[];
  /** Duration (ms). */
  durationMs: number;
  /** Error if failed. */
  error?: string;
}

/** Effect application result. */
export interface EffectResult {
  /** Effect type. */
  type: string;
  /** Target term. */
  term: Term;
  /** Success. */
  success: boolean;
  /** New truth if updated. */
  newTruth?: Truth;
}

/** Judgment result. */
export interface JudgmentResult {
  /** Judgment ID. */
  judgmentId: string;
  /** Task judged. */
  task: EconomyTask;
  /** Score. */
  score: number;
  /** Confidence. */
  confidence: number;
  /** Details. */
  details: Record<string, unknown>;
}

/** Loop context passed to components. */
export interface LoopContext {
  /** Current iteration. */
  iteration: number;
  /** Deterministic environment. */
  env: Env;
  /** Economy instance. */
  economy: Economy;
  /** Economy scheduler. */
  scheduler: EconomyScheduler;
  /** Faculty registry. */
  faculties: FacultyRegistry;
  /** Oracle registry. */
  oracles: OracleRegistry;
  /** Contract registry. */
  contracts?: ContractRegistry;
  /** Repair loop. */
  repair?: RepairLoop;
  /** Recorder. */
  recorder?: LoopRecorder;
  /** Self-model. */
  selfModel?: SelfModelManager;
  /** Action selector. */
  selector: ActionSelector;
  /** Configuration. */
  config: LoopConfig;
  /** Correlation ID. */
  correlationId: string;
}

/** Loop event types. */
export const LOOP_EVENTS = [
  'iteration_start',
  'iteration_complete',
  'iteration_failed',
  'selection_made',
  'action_executed',
  'judgment_complete',
  'contract_checked',
  'repair_complete',
  'appraisal_complete',
  'max_iterations_reached',
  'timeout',
] as const;

export type LoopEventType = (typeof LOOP_EVENTS)[number];

export interface LoopEvent {
  type: LoopEventType;
  iteration: number;
  timestamp: number;
  correlationId: string;
  data: Record<string, unknown>;
}

/** Faculty invoker. */
export interface FacultyInvoker {
  spec: FacultySpec;
  invoke: (input: FacultyInput) => Promise<FacultyOutput>;
}