/**
 * Loop Types — shared type definitions for the cognitive loop.
 */
import type { EconomyTask, EconomyState, SchedulerResult, SchedulerConfig, Successor } from '../economy/index';
import type { FacultyRegistry, FacultySpec, FacultyInput, FacultyOutput } from '../faculties/specs';
import type { OracleRegistry, Oracle } from '../oracles/oracle';
import type { Term } from '../kernel/terms';
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
import type { RNG, Clock } from '../kernel/env';
/** Re-export commonly used types. */
export type { EconomyTask, EconomyState, SchedulerResult, SchedulerConfig, FacultyRegistry, FacultySpec, FacultyInput, FacultyOutput, OracleRegistry, Oracle, Term, Task, Truth, LoopAppraisal, RepairLoop, RepairContext, LoopRepairResult, ContractCheckResult, ContractContext, SelectionResult, SelectionCandidate, SelectionContext, ActionSelector, ContractRegistry, LoopRecorder, SelfModelManager, RNG, Clock, };
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
export declare const defaultLoopConfig: LoopConfig;
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
    /** Economy state. */
    economyState: EconomyState;
    /** Pure schedule function. */
    schedule: (state: EconomyState, rng: RNG, clock: Clock, successors?: Map<string, Successor[]>) => SchedulerResult;
    /** Pure economy functions. */
    economy: {
        addTask: (state: EconomyState, task: EconomyTask) => EconomyState;
        removeTask: (state: EconomyState, taskId: string) => EconomyState;
        updateTask: (state: EconomyState, taskId: string, updates: Partial<EconomyTask>, clock: Clock) => EconomyState;
        getTask: (state: EconomyState, taskId: string) => EconomyTask | undefined;
        getTasksByKind: (state: EconomyState, kind: EconomyTask['kind']) => EconomyTask[];
        getAllTasks: (state: EconomyState) => EconomyTask[];
        activateOverlay: (state: EconomyState, overlay: import('../economy/index').Overlay) => EconomyState;
        deactivateOverlay: (state: EconomyState, overlayId: string) => EconomyState;
        getStats: (state: EconomyState) => import('../economy/index').SchedulerStats;
        getPickHistory: (state: EconomyState) => import('../economy/index').PickRecord[];
        setSeed: (state: EconomyState, seed: number, rng: RNG) => EconomyState;
    };
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
export declare const LOOP_EVENTS: readonly ['iteration_start', 'iteration_complete', 'iteration_failed', 'selection_made', 'action_executed', 'judgment_complete', 'contract_checked', 'repair_complete', 'appraisal_complete', 'max_iterations_reached', 'timeout'];
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
//# sourceMappingURL=types.d.ts.map