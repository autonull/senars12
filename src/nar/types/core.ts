/**
 * Core type definitions for NARS12
 * Single source of truth for foundational types
 */

import type { Term } from '../terms/types.js';
import type { Truth } from '../terms/truth.js';
import { Stamp } from '../terms/stamp.js';

// Re-export domain types
export type { Term, AtomicTerm, CompoundTerm } from '../terms/types.js';
export type { Truth } from '../terms/truth.js';
export type { Stamp as StampType, Source } from '../terms/stamp.js';

// Core identity and hashing
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
  readonly truth: Truth;
  readonly budget: Budget | number;
  readonly stamp: ReturnType<typeof Stamp.createInput>;
  readonly occurrenceTime: number;
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
  readonly priorityThreshold: number;
  readonly activationDecayRate: number;
  readonly consolidationInterval: number;
  readonly cpuThrottleMs: number;
  readonly maxDerivationDepth: number;
  readonly maxDerivationsPerStep: number;
}

// Default configuration values
export const DEFAULT_CONFIG: CoreConfig = Object.freeze({
  maxConcepts: 1000,
  priorityThreshold: 0.5,
  activationDecayRate: 0.01,
  consolidationInterval: 10,
  cpuThrottleMs: 10,
  maxDerivationDepth: 10,
  maxDerivationsPerStep: 1000
});

// Utility types
export type Nullable<T> = T | null;
export type Optional<T> = T | undefined;

// Result types for operations
export interface Success<T> {
  readonly success: true;
  readonly data: T;
}

export interface Failure {
  readonly success: false;
  readonly error: Error;
}

export type Result<T> = Success<T> | Failure;

// Helper functions
export const success = <T>(data: T): Success<T> => ({ success: true, data });
export const failure = (error: Error): Failure => ({ success: false, error });

// Budget helpers
export const isBudget = (b: Budget | number): b is Budget =>
  typeof b === 'object' && 'priority' in b;

export const getBudgetValue = (b: Budget | number): number =>
  typeof b === 'number' ? b : b.priority;

// Create Budget object
export const createBudget = (
  priority: number,
  durability = 0.8,
  quality = 0.9,
  cycles = 0,
  depth = 0
): Budget =>
  Object.freeze({ priority, durability, quality, cycles, depth });

// Create Task object
export const createTask = (
  term: Term,
  type: TaskType,
  truth: Truth,
  budget: Budget | number = 0.9
): Task => {
  const now = Date.now();
  return {
    term,
    type,
    truth,
    budget,
    stamp: Stamp.createInput(),
    occurrenceTime: now,
    derived: false
  };
};
