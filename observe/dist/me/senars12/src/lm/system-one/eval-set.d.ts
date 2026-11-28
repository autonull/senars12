/**
 * Frozen evaluation set (TODO23 Phase 2): a digest-pinned label snapshot
 * written once and read-only at train time, so teacher-error data cannot
 * migrate into training across distillation generations. Conversation-captured
 * rows (TODO22 auto-capture) are excluded by construction.
 */
import { SenarsError } from '@senars/errors';
import type { JudgmentDataset } from './distill';
/** TODO22 auto-capture source — never eligible for the frozen set. */
export declare const CONVERSATION_SOURCE = "conversation";
/** TODO24 dialogue-reaction source — never eligible for the frozen set (I1). */
export declare const REACTION_SOURCE = "reaction";
export interface FrozenEvalRow {
    headId: string;
    predicted: number;
    observed: number;
    /** Optional domain marker: OOD rows form the `lock.ood` slice (Phase 7). */
    domain?: 'in-domain' | 'ood';
}
export interface FrozenEvalSet {
    version: 'eval-set-v1';
    createdAt: number;
    /** Digest of the source dataset rows at freeze time. */
    sourceDigest: string;
    /** Digest pin over the frozen rows; verified fail-closed on every load. */
    digest: string;
    rows: readonly FrozenEvalRow[];
}
export interface EvalMetrics {
    brier: number;
    ece: number;
    count: number;
}
export declare class EvalRegressionError extends SenarsError {
    readonly baseline: number;
    readonly candidate: number;
    readonly tolerance: number;
    constructor(reason: string, baseline: number, candidate: number, tolerance: number);
}
export declare function digestRows(rows: readonly FrozenEvalRow[]): string;
/**
 * Freeze (predicted, observed) pairs from the distillation dataset.
 * `conversation`-sourced rows are excluded by construction (default), so
 * auto-captured graded turns can never re-enter evaluation.
 */
export declare function createFrozenEvalSet(dataset: JudgmentDataset, options?: {
    excludeSources?: readonly string[];
}): FrozenEvalSet;
/** Split a frozen set into in-domain and OOD slices (Phase 7 lock metrics). */
export declare function splitOod(rows: readonly FrozenEvalRow[]): {
    inDomain: FrozenEvalRow[];
    ood: FrozenEvalRow[];
};
/** Brier + ECE over the frozen rows (per-row; head-level breakdown via `headMetrics`). */
export declare function evalMetrics(rows: readonly FrozenEvalRow[]): EvalMetrics;
export declare function headMetrics(rows: readonly FrozenEvalRow[]): Record<string, EvalMetrics>;
export declare function writeEvalSet(set: FrozenEvalSet, path: string): Promise<void>;
/** Fail-closed: a digest mismatch (corrupted or tampered snapshot) throws. */
export declare function loadEvalSet(path: string): Promise<FrozenEvalSet>;
/**
 * Promotion gate (Phase 2): a candidate head must not regress on the frozen
 * set beyond `tolerance`. Compares Brier — lower is better.
 */
export declare function assertFrozenNonRegression(baseline: EvalMetrics, candidate: EvalMetrics, tolerance?: number): void;
//# sourceMappingURL=eval-set.d.ts.map