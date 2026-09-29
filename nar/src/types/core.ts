/**
 * Core type definitions for NARS12
 * Single source of truth for foundational types
 */

import type { Term } from '../terms';
import { Stamp, Truth } from '../terms';
import type { Truth as TruthType } from '../terms/truth.js';
import { type NarCoreBoundKey, narCoreBounds } from '@senars/util/config';
import { createTimestamp, DEPTH_MAX, type Timestamp } from './primitives.js';

export type { Source, Stamp } from '../terms/stamp.js';
export type { Truth as TruthType } from '../terms/truth.js';
// Re-export domain types
export type { AtomicTerm, CompoundTerm, Term } from '../terms/types.js';

// Core identity and hashing

// Branded types for temporal and probabilistic reasoning safety
export type { Duration, Timestamp } from './primitives.js';
export { createDuration, createTimestamp, DEPTH_MAX } from './primitives.js';

export type Hash = number;
export type TermSymbol = string;

// Budget and priority system
export interface Budget {
  readonly priority: number;
  readonly durability: number;
  readonly quality: number;
  readonly cycles: number;
  readonly depth: number;
}

// Task types
export type TaskType = 'belief' | 'goal' | 'question' | 'command';

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
export const DEFAULT_CONFIG: CoreConfig = Object.freeze(
  Object.fromEntries(
    Object.keys(narCoreBounds).map((key) => [key, narCoreBounds[key as NarCoreBoundKey].default])
  ) as unknown as CoreConfig
);

// Utility types
export type Nullable<T> = T | null;
export type Optional<T> = T | undefined;

// Result types for operations — E2: canonical definition lives in utils/result.ts
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
} from '../utils/result.js';

// Create Budget object - optimized with defaults
export const createBudget = (
  priority: number,
  durability = 0.8,
  quality = 0.9,
  cycles = 0,
  depth = 0
): Budget => Object.freeze({ priority, durability, quality, cycles, depth });

// Pre-allocated neutral budget for performance
export const NEUTRAL_BUDGET = createBudget(0.5);

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
): Task => ({
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
): Task => createTask(term, 'belief', truth, createBudget(priority), stamp ? { stamp } : {});

// Create secondary task from concept or belief - unified replacement for createTaskFromBelief/createTaskFromConcept
export const createSecondaryTask = (
  term: Term,
  priority: number,
  truth?: TruthType,
  type: TaskType = 'belief'
): Task => ({
  term,
  type,
  truth: (truth as TruthType) ?? Truth.NEUTRAL,
  budget: createBudget(priority),
  stamp: Stamp.createInput(),
  occurrenceTime: createTimestamp(0),
  derived: false,
});

// Runtime assertion for belief tasks — crash early instead of silently fabricating values
export function assertBeliefTask(task: Task): asserts task is Task & { truth: TruthType } {
  if (task.type !== 'question' && !task.truth) {
    throw new Error(`Bug: ${task.type} task missing truth: ${task.term}`);
  }
}

// Error types for better error handling — the taxonomy lives in `@senars/util`;
// these aliases are the legacy spelling the `types` barrel and its importers use.
/** @deprecated since 0.6.0 — use `SenarsError` from `@senars/util/errors`. */
export { SenarsError as NARError } from '@senars/util';
/** @deprecated since 0.6.0 — use `ValidationError` from `@senars/util/errors`. */
export { ValidationError } from '@senars/util/errors';
/** @deprecated since 0.6.0 — use `ConfigurationError` from `@senars/util/errors`. */
export { ConfigurationError } from '@senars/util/errors';
/** @deprecated since 0.6.0 — use `OperationError` from `@senars/util/errors`. */
export { OperationError } from '@senars/util/errors';
/** @deprecated since 0.6.0 — use `ToolError` from `@senars/util/errors`. */
export { ToolError } from '@senars/util/errors';

// Query filter types
export interface TermFilter {
  contains?: string;
  startsWith?: string;
  endsWith?: string;
  pattern?: RegExp;
  limit?: number;
  truthRange?: [number, number];
  recency?: number;
  type?: 'belief' | 'goal' | 'question' | 'command';
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
