/**
 * Core type definitions for NARS12
 * Single source of truth for foundational types
 */

import type { Term } from '../terms';
import { Stamp, Truth } from '../terms';
import type { Truth as TruthType } from '../terms/truth.js';

export type { Source, Stamp } from '../terms/stamp.js';
export type { Truth as TruthType } from '../terms/truth.js';
// Re-export domain types
export type { AtomicTerm, CompoundTerm, Term } from '../terms/types.js';

// Core identity and hashing

// Branded types for temporal and probabilistic reasoning safety
export type Timestamp = number & { readonly __brand: unique symbol };
export type Duration = number & { readonly __brand: unique symbol };

export const createTimestamp = (ms?: number): Timestamp => (ms ?? Date.now()) as Timestamp;
export const createDuration = (ms: number): Duration => ms as Duration;

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
}

// Default configuration values
export const DEFAULT_CONFIG: CoreConfig = Object.freeze({
  maxConcepts: 1000,
  activationDecayRate: 0.01,
  consolidationInterval: 10,
  cpuThrottleMs: 10,
  maxDerivationDepth: 10,
  maxDerivationsPerStep: 1000,
});

// Utility types
export type Nullable<T> = T | null;
export type Optional<T> = T | undefined;

// Result types for operations
export type Success<T> = { readonly success: true; readonly data: T };

export type Failure = { readonly success: false; readonly error: Error };

export type Result<T> = Success<T> | Failure;

// Helper functions
export const success = <T>(data: T): Success<T> => ({ success: true, data });
export const failure = (error: Error): Failure => ({ success: false, error });

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

// Create Task object - optimized
export const createTask = (
  term: Term,
  type: TaskType,
  truth: TruthType,
  budget: Budget = NEUTRAL_BUDGET
): Task => ({
  term,
  type,
  truth,
  budget,
  stamp: Stamp.createInput(),
  occurrenceTime: createTimestamp(),
  derived: false,
});

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

// Error types for better error handling
/**
 * @deprecated Will be removed in next major version.
 * Use `import { SenarsError } from '@senars/util'` instead.
 */
/**
 * @deprecated Will be removed in next major version.
 * Use `import { ValidationError } from '@senars/util'` instead.
 */
/**
 * @deprecated Will be removed in next major version.
 * Use `import { ConfigurationError } from '@senars/util'` instead.
 */
/**
 * @deprecated Will be removed in next major version.
 * Use `import { OperationError } from '@senars/util'` instead.
 */
/**
 * @deprecated Will be removed in next major version.
 * Use `import { ToolError } from '@senars/util'` instead.
 */
export {
  ConfigurationError,
  OperationError,
  SenarsError as NARError,
  ToolError,
  ValidationError,
} from '@senars/util';

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

// Type guards
export const isSuccess = <T>(result: Result<T>): result is Success<T> => result.success;

export const isFailure = <T>(result: Result<T>): result is Failure => !result.success;

// Internal: base stats interface for metrics aggregation
export interface BaseStats {
  uptime?: number;

  [key: string]: unknown;
}
