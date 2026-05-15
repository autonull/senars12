/**
 * Core type definitions for NARS12
 * Single source of truth for foundational types
 */

import type {Term} from '../terms';
import {Stamp, Truth} from '../terms';
import type {Truth as TruthType} from '../terms/truth.js';

// Re-export domain types
export type {Term, AtomicTerm, CompoundTerm} from '../terms/types.js';
export type {Truth as TruthType} from '../terms/truth.js';
export type {Stamp, Source} from '../terms/stamp.js';

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
    readonly truth: TruthType;
    readonly budget: Budget;
    readonly stamp: Stamp;
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
export type Success<T> = { readonly success: true; readonly data: T };

export type Failure = { readonly success: false; readonly error: Error };

export type Result<T> = Success<T> | Failure;

// Helper functions
export const success = <T>(data: T): Success<T> => ({success: true, data});
export const failure = (error: Error): Failure => ({success: false, error});

// Create Budget object - optimized with defaults
export const createBudget = (
    priority: number,
    durability = 0.8,
    quality = 0.9,
    cycles = 0,
    depth = 0
): Budget =>
    Object.freeze({priority, durability, quality, cycles, depth});

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
    occurrenceTime: Date.now(),
    derived: false
});

// Create secondary task from concept or belief - unified replacement for createTaskFromBelief/createTaskFromConcept
export const createSecondaryTask = (
    term: Term,
    priority: number,
    truth?: { f: number; c: number },
    type: TaskType = 'belief'
): Task => ({
    term,
    type,
    truth: truth ?? Truth.NEUTRAL,
    budget: createBudget(priority),
    stamp: Stamp.createInput(),
    occurrenceTime: 0,
    derived: false
});

// Error types for better error handling
export class NARError extends Error {
    constructor(
        message: string,
        public readonly code: string,
        public readonly context?: Record<string, unknown>
    ) {
        super(message);
        this.name = 'NARError';
    }
}

export class ValidationError extends NARError {
    constructor(message: string, context?: Record<string, unknown>) {
        super(message, 'VALIDATION_ERROR', context);
        this.name = 'ValidationError';
    }
}

export class ConfigurationError extends NARError {
    constructor(message: string, context?: Record<string, unknown>) {
        super(message, 'CONFIGURATION_ERROR', context);
        this.name = 'ConfigurationError';
    }
}

export class OperationError extends NARError {
    constructor(message: string, context?: Record<string, unknown>) {
        super(message, 'OPERATION_ERROR', context);
        this.name = 'OperationError';
    }
}

export class ToolError extends NARError {
    constructor(message: string, context?: Record<string, unknown>) {
        super(message, 'TOOL_ERROR', context);
        this.name = 'ToolError';
    }
}

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
export const isSuccess = <T>(result: Result<T>): result is Success<T> =>
    result.success;

export const isFailure = <T>(result: Result<T>): result is Failure =>
    !result.success;

// Internal: base stats interface for metrics aggregation
export interface BaseStats {
    uptime?: number;

    [key: string]: unknown;
}
