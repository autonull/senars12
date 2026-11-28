/**
 * Kernel Types — shared type definitions and utilities.
 *
 * Compatibility layer for generated schemas:
 * - Generated schemas use `frequency`/`confidence`
 * - Internal code uses `f`/`c` for brevity
 * This module provides both interfaces.
 */
import type { Term } from './terms';
/** Timestamp in milliseconds since epoch. */
export type TimestampMs = number;
/** Frequency in [0, 1]. */
export type Frequency = number;
/** Confidence in [0, 1]. */
export type Confidence = number;
/** Truth-like input for normalization (matches generated schema). */
export interface TruthLike {
    frequency: number;
    confidence: number;
}
/** Truth value (internal representation with short properties). */
export interface TruthValue {
    readonly f: Frequency;
    readonly c: Confidence;
}
/** Truth value (generated schema representation). */
export interface TruthValueSchema {
    readonly frequency: Frequency;
    readonly confidence: Confidence;
}
/** Convert internal TruthValue to schema TruthValue. */
export declare function toSchemaTruth(t: TruthValue): TruthValueSchema;
/** Convert schema TruthValue to internal TruthValue. */
export declare function fromSchemaTruth(t: TruthValueSchema): TruthValue;
/** UUID type (matches generated schema uuid() output). */
export type UUID = string;
/** Stamp for temporal/causal tracking. */
export interface Stamp {
    readonly id: UUID;
    readonly ts: TimestampMs;
    readonly parents: readonly UUID[];
    readonly derivation: readonly string[];
    readonly evidence: number;
}
/** Task type enumeration. */
export declare enum TaskType {
    BELIEF = "belief",
    GOAL = "goal",
    QUESTION = "question"
}
/** Task punctuation. */
export declare enum TaskPunctuation {
    STATEMENT = ".",
    QUESTION = "?",
    GOAL = "!"
}
/** Task bag kind. */
export declare enum TaskBagKind {
    DERIVATION = "derivation",
    INPUT = "input",
    OUTPUT = "output"
}
/** Task representation. */
export interface Task {
    readonly term: Term;
    readonly type: TaskType;
    readonly truth: TruthValue;
    readonly priority: number;
    readonly stamp?: Stamp;
    readonly createdAt?: number;
    readonly id?: string;
}
/** Create a task. */
export declare function createTask(term: Term, type: TaskType, truth: TruthValue, priority: number, stamp?: Stamp): Task;
//# sourceMappingURL=types.d.ts.map