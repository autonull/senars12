/**
 * Economy Scheduler — pure functions for the task economy.
 *
 * Replaces EconomyScheduler class with pure functions operating on EconomyState.
 * No mutation, no event bus, deterministic.
 */
import { type EconomyTask, type EconomyTaskBagKind as TaskBagKind, type SchedulerConfig, type SchedulerStats, type EconomyState, type Overlay, type Successor, type PickRecord } from './types';
import type { Clock, RNG } from '../kernel/env';
/** Scheduler result. */
export interface SchedulerResult {
    /** Selected task. */
    task: EconomyTask | null;
    /** New economy state after scheduling. */
    newState: EconomyState;
    /** All candidates with utilities. */
    candidates: Array<{
        task: EconomyTask;
        utility: number;
    }>;
    /** Whether this was an exploration pick. */
    explored: boolean;
    /** Scheduler metadata. */
    metadata: {
        iteration: number;
        budgetUsed: number;
        budgetRemaining: number;
        durationMs: number;
        fairnessCheck: FairnessCheck;
    };
}
/** Fairness check result. */
export interface FairnessCheck {
    /** Passed. */
    passed: boolean;
    /** Violations. */
    violations: FairnessViolation[];
    /** Window stats. */
    windowStats: Map<string, number>;
}
/** Fairness violation. */
export interface FairnessViolation {
    /** Task kind that was starved. */
    kind: TaskBagKind;
    /** Expected minimum picks. */
    expected: number;
    /** Actual picks. */
    actual: number;
    /** Window size. */
    window: number;
}
/** Create initial economy state. */
export declare function createInitialState(config?: Partial<SchedulerConfig>): EconomyState;
/** Add a task to the economy state. */
export declare function addTask(state: EconomyState, task: EconomyTask): EconomyState;
/** Remove a task from the economy state. */
export declare function removeTask(state: EconomyState, taskId: string): EconomyState;
/** Update a task in the economy state. */
export declare function updateTask(state: EconomyState, taskId: string, updates: Partial<EconomyTask>, clock: Clock): EconomyState;
/** Get a task by ID. */
export declare function getTask(state: EconomyState, taskId: string): EconomyTask | undefined;
/** Get all tasks of a kind. */
export declare function getTasksByKind(state: EconomyState, kind: TaskBagKind): EconomyTask[];
/** Get all tasks. */
export declare function getAllTasks(state: EconomyState): EconomyTask[];
/** Activate an overlay. */
export declare function activateOverlay(state: EconomyState, overlay: Overlay): EconomyState;
/** Deactivate an overlay. */
export declare function deactivateOverlay(state: EconomyState, overlayId: string): EconomyState;
/** Pure schedule function: (state, rng, clock, successors?) -> { task, newState, candidates, explored, metadata }. */
export declare function schedule(state: EconomyState, rng: RNG, clock: Clock, successors?: Map<string, Successor[]>): SchedulerResult;
/** Get scheduler stats. */
export declare function getStats(state: EconomyState): SchedulerStats;
/** Get pick history. */
export declare function getPickHistory(state: EconomyState): PickRecord[];
/** Set RNG seed for determinism (returns new state with updated RNG if applicable). */
export declare function setSeed(state: EconomyState, seed: number, rng: RNG): EconomyState;
/** Create initial economy state from config. */
export declare function createEconomyState(config?: Partial<SchedulerConfig>): EconomyState;
/** Create initial economy state from Env. */
export declare function createEconomyStateFromEnv(env: {
    rng: RNG;
    clock: Clock;
}, config?: Partial<SchedulerConfig>): EconomyState;
/** Default economy state. */
export declare const defaultEconomyState: EconomyState;
//# sourceMappingURL=scheduler.d.ts.map