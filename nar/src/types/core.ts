/**
 * Core type definitions for NARS12
 * Single source of truth for foundational types
 */

import { narCoreBounds, narCoreDefaults } from '@senars/util/config';
import type { Term } from '../terms';
import { Stamp, Truth } from '../terms';
import type { Truth as TruthType } from '../terms/impls/Truth.js';
import { canonicalTask } from '../terms/reduce-task.js';
import { createTimestamp, DEPTH_MAX, type Timestamp } from './primitives.js';

export type { Source, Stamp } from '../terms/impls/Stamp.js';
export type { Truth as TruthType } from '../terms/impls/Truth.js';
// Re-export domain types
export type { AtomicTerm, CompoundTerm, Term } from '../terms/types.js';

// Core identity and hashing

// Branded types for temporal and probabilistic reasoning safety
export type { Duration, Timestamp } from './primitives.js';
export { createDuration, createTimestamp, DEPTH_MAX } from './primitives.js';

export type Hash = number;
export type TermSymbol = string;

// Budget and priority system — one shape, validated by the schema that admits it
import type { Budget, TaskType } from '@senars/core/schemas';

export type { Budget, TaskType };

// Core Task interface
export interface Task {
  readonly term: Term;
  readonly type: TaskType;
  readonly truth: TruthType;
  readonly budget: Budget;
  readonly stamp: Stamp;
  readonly occurrenceTime: Timestamp;
  readonly derived: boolean;
}

// Memory concepts
export interface ConceptLike {
  readonly term: Term;
  readonly priority: number;
  readonly totalTasks: number;
}

// Configuration interfaces
export interface CoreConfig {
  readonly maxConcepts: number;
  readonly activationDecayRate: number;
  readonly consolidationInterval: number;
  readonly cpuThrottleMs: number;
  readonly maxDerivationDepth: number;
  readonly maxDerivationsPerStep: number;
  readonly sampleSize: number;
}

// Default configuration values — one table, so a limit and its default can never disagree.
export const DEFAULT_CONFIG: CoreConfig = Object.freeze(narCoreDefaults);

// Utility types
export type Nullable<T> = T | null;
export type Optional<T> = T | undefined;

// Result types for operations — canonical definition lives in @senars/util
export {
  attempt,
  attemptAsync,
  type Err,
  err,
  flatMap,
  getOrElse,
  isErr,
  isOk,
  map,
  type Ok,
  ok,
  type Result,
  unwrapOrThrow,
} from '@senars/util';

// Create Budget object - optimized with defaults
export const createTaskWeight = (
  priority: number,
  durability = 0.8,
  quality = 0.9,
  cycles = 0,
  depth = 0
): Budget => Object.freeze({ priority, durability, quality, cycles, depth });

// Pre-allocated neutral budget for performance
export const NEUTRAL_BUDGET = createTaskWeight(0.5);

/** Fields a caller may pin when the defaults (input stamp, now, not derived) are wrong. */
export interface TaskOverrides {
  stamp?: Stamp;
  occurrenceTime?: Timestamp;
  derived?: boolean;
}

// Create Task object - optimized
export const createTask = (
  term: Term,
  type: TaskType,
  truth: TruthType,
  budget: Budget = NEUTRAL_BUDGET,
  overrides: TaskOverrides = {}
): Task =>
  canonicalTask({
    term,
    type,
    truth,
    budget,
    stamp: overrides.stamp ?? Stamp.createInput(),
    occurrenceTime: overrides.occurrenceTime ?? createTimestamp(),
    derived: overrides.derived ?? false,
  });

/** Belief task at a concept's priority; `stamp` defaults to a fresh input stamp. */
export const createBeliefTask = (
  term: Term,
  truth: TruthType,
  priority: number,
  stamp?: Stamp
): Task => createTask(term, 'belief', truth, createTaskWeight(priority), stamp ? { stamp } : {});

// Create secondary task from concept or belief - unified replacement for createTaskFromBelief/createTaskFromConcept
export const createSecondaryTask = (
  term: Term,
  priority: number,
  truth?: TruthType,
  type: TaskType = 'belief'
): Task =>
  canonicalTask({
    term,
    type,
    truth: (truth as TruthType) ?? Truth.NEUTRAL,
    budget: createTaskWeight(priority),
    stamp: Stamp.createInput(),
    occurrenceTime: createTimestamp(0),
    derived: false,
  });

// The error taxonomy is declared in `@senars/util` — a leaf package with zero
// workspace dependencies, so both core and nar can depend on it. These are
// re-exports, not aliases: the identity is the same class either way.
export {
  ConfigurationError,
  OperationError,
  ToolError,
  ValidationError,
} from '@senars/util/errors';

// Query filter types
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

// Internal: base stats interface for metrics aggregation
export interface BaseStats {
  uptime?: number;

  [key: string]: unknown;
}
