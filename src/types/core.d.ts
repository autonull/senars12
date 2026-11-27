/**
 * Core type definitions for NARS12
 * Single source of truth for foundational types
 */
import type { Term } from '../terms';
import { Stamp } from '../terms';
import type { Truth as TruthType } from '../terms/impls/Truth';
import { type Timestamp } from './primitives';
import type { Task } from './task';
export type { Source, Stamp } from '../terms/impls/Stamp';
export type { Truth as TruthType } from '../terms/impls/Truth';
export type { AtomicTerm, CompoundTerm, Term } from '../terms/types';
export type { Duration, Timestamp } from './primitives';
export { createDuration, createTimestamp, DEPTH_MAX } from './primitives';
export type Hash = number;
export type TermSymbol = string;
import type { Budget, TaskType } from '@senars/schemas';
export type { Budget, TaskType };
export type { Task } from './task';
export interface ConceptLike {
    readonly term: Term;
    readonly priority: number;
    readonly totalTasks: number;
}
export interface CoreConfig {
    readonly maxConcepts: number;
    readonly activationDecayRate: number;
    readonly consolidationInterval: number;
    readonly cpuThrottleMs: number;
    readonly maxDerivationDepth: number;
    readonly maxDerivationsPerStep: number;
    readonly sampleSize: number;
}
export declare const DEFAULT_CONFIG: CoreConfig;
export type Nullable<T> = T | null;
export type Optional<T> = T | undefined;
export { attempt, attemptAsync, type Err, err, flatMap, getOrElse, isErr, isOk, map, type Ok, ok, type Result, unwrapOrThrow, } from '@senars/util/result';
export declare const createTaskWeight: (priority: number, durability?: number, quality?: number, cycles?: number, depth?: number) => Budget;
export declare const NEUTRAL_BUDGET: Budget;
/** Fields a caller may pin when the defaults (input stamp, now, not derived) are wrong. */
export interface TaskOverrides {
    stamp?: Stamp;
    occurrenceTime?: Timestamp;
    derived?: boolean;
}
export declare const createTask: (term: Term, type: TaskType, truth: TruthType, budget?: Budget, overrides?: TaskOverrides) => Task;
/** Belief task at a concept's priority; `stamp` defaults to a fresh input stamp. */
export declare const createBeliefTask: (term: Term, truth: TruthType, priority: number, stamp?: Stamp) => Task;
export declare const createSecondaryTask: (term: Term, priority: number, truth?: TruthType, type?: TaskType) => Task;
export { ConfigurationError, OperationError, ToolError, ValidationError, } from '../errors';
/**
 * The filters `QueryAPI.applyFilters` actually honours. It also declared
 * `contains` / `startsWith` / `endsWith` / `pattern`, which it silently ignored:
 * a caller narrowing by text got an unfiltered list back and no signal why.
 * Substring matching has one implementation — `filterByTerm` in
 * `memory/term-filter.ts` — and callers reach it directly.
 */
export interface TermFilter {
    limit?: number;
    truthRange?: [number, number];
    recency?: number;
    type?: TaskType;
}
export interface TruthFilter {
    minFrequency?: number;
    maxFrequency?: number;
    minConfidence?: number;
    maxConfidence?: number;
}
export interface QueryOptions {
    limit?: number;
    sortBy?: 'priority' | 'recency' | 'truth';
    order?: 'asc' | 'desc';
    termFilter?: TermFilter;
    truthFilter?: TruthFilter;
}
export interface BaseStats {
    uptime?: number;
    [key: string]: unknown;
}
//# sourceMappingURL=core.d.ts.map