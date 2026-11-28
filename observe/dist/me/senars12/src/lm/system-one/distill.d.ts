import type { SelfImprovementProposal } from '@senars/schemas';
import { type RolloverPolicy } from '@senars/util/ledger';
import { z } from 'zod';
import { type Truth as TruthType } from '../../terms/impls/Truth';
import type { JudgmentProposition } from './types';
/** Input-anchored evidence identity: same utterance ⇒ same evidence, regardless of re-judging. */
export declare const computeEvidenceId: (utteranceId: string, sourceSpan: string) => string;
/**
 * Promotion of a provisional hypothesis by a later judgment pass.
 * Evidence-weighted revision caps at MAX_CONFIDENCE — re-judging the same
 * evidence never inflates confidence beyond the NAL revision bound.
 */
export declare function promoteProvisional(current: TruthType | undefined, incoming: JudgmentProposition): TruthType;
export declare function decodeVector(b64: string): Float32Array;
export interface DistillationLabel {
    evidenceId: string;
    rubric: string;
    axis: string;
    label: string;
    score?: number;
    /** Ground-truth outcome recorded at label time (D2 calibration input). */
    observed?: number;
    /** Inline vector data (base64-encoded 384-d Float32Array). Replaces vecRef sidecar. */
    vector?: string;
    source: string;
    /** H5/X18: which Cortex model produced the candidates this label judged. */
    cortexModelId?: string;
    /** TODO23: domain marker — 'ood' rows form the frozen-set OOD slice. */
    domain?: 'in-domain' | 'ood';
}
/** Ledger entry schema for distillation labels with inline vectors. */
declare const DistillationLabelEntrySchema: z.ZodObject<{
    at: z.ZodNumber;
    correlationId: z.ZodOptional<z.ZodString>;
    sessionId: z.ZodOptional<z.ZodString>;
    evidenceId: z.ZodString;
    rubric: z.ZodString;
    axis: z.ZodString;
    label: z.ZodString;
    score: z.ZodOptional<z.ZodNumber>;
    observed: z.ZodOptional<z.ZodNumber>;
    vector: z.ZodOptional<z.ZodString>;
    source: z.ZodString;
    cortexModelId: z.ZodOptional<z.ZodString>;
    domain: z.ZodOptional<z.ZodEnum<{
        "in-domain": "in-domain";
        ood: "ood";
    }>>;
}, z.core.$strip>;
export type DistillationLabelEntry = z.infer<typeof DistillationLabelEntrySchema>;
/** Append-only, redaction-per-retention: hashes + labels + inline vectors, never raw text. */
export declare class JudgmentDataset {
    #private;
    constructor(basePath: string, options?: {
        rollover?: RolloverPolicy;
    });
    /** Record a label with optional inline vector (base64-encoded). */
    record(label: DistillationLabel, embedding?: Float32Array): void;
    /** Get the vector for a given evidenceId (synchronous, from in-memory index). */
    getVector(evidenceId: string): Float32Array | undefined;
    /** Get all labels (synchronous, from the ledger's mirror). */
    all(): readonly DistillationLabel[];
    get size(): number;
    /** Labels with their sidecar vectors inlined, as JSON-ready rows. */
    rows(): DistillationLabelEntry[];
    /**
     * Rows as newline-joined JSON — one payload a caller can hand to `JSON.parse`,
     * so the on-disk trailing newline that {@link jsonlPayload} appends is dropped
     * here. Flushing keeps it; serialization does not.
     */
    toJSONL(): string;
    /**
     * Append the labels recorded since the last flush to a JSONL file.
     *
     * Incremental because the caller is a timer: the export mirrors the dataset,
     * and re-appending the whole window every interval wrote the same rows over
     * and over while serializing fifty thousand of them each time. A `load()`
     * -then-`flush()` pair resets the cursor, so a round trip still exports every
     * label exactly once.
     */
    flush(path: string): Promise<void>;
    /** Load a JSONL file and replace the current dataset. */
    static load(path: string, basePath?: string): Promise<JudgmentDataset>;
    /**
     * Compaction for the append-only dataset — dedupe rows by evidenceId (last wins).
     * Returns `{kept, dropped}`.
     */
    static compact(datasetPath: string): Promise<{
        kept: number;
        dropped: number;
    }>;
    /**
     * Periodic append of recorded labels to `path` (auto-flush).
     *
     * The returned stop cancels the timer *and* resolves once the flush it already
     * started has landed. Cancelling the timer alone left that write in flight, so
     * a caller that stopped and immediately read the file back — the round trip
     * `load()`-then-`flush()` exists to support — raced it.
     */
    startAutoFlush(path: string, intervalMs?: number): () => Promise<void>;
    /** Close the ledger (stop timers, flush). */
    close(): void;
}
export interface HeadCandidateSpec {
    headId: string;
    modelDigest: string;
    calibrationVersion: string;
    abstainThreshold: number;
    enabled: boolean;
}
export interface BakeOffCase {
    /** Ground truth, 0..1 */
    truth: number;
    /** Incumbent head predicted score, 0..1 */
    incumbent: number;
    /** Candidate head predicted score, 0..1 */
    candidate: number;
}
export interface BakeOffResult {
    /** H5/X18: model id recorded on bake-off artifacts for label provenance. */
    cortexModelId?: string;
    incumbentAccuracy: number;
    candidateAccuracy: number;
    parityGap: number;
    withinParity: boolean;
    accepted: boolean;
    reason: string;
    /** TODO23 Phase 2: frozen-set non-regression report (present when frozen cases supplied). */
    frozen?: {
        baselineBrier: number;
        candidateBrier: number;
        nonRegression: boolean;
    };
}
/** Bench 10: promoted head matches incumbent accuracy on shadow bake-off within 2%. */
export declare function runBakeOff(_incumbent: HeadCandidateSpec | undefined, _candidate: HeadCandidateSpec, cases: readonly BakeOffCase[], parityTolerance?: number, _eceBound?: number, 
/** Governance option: accept strictly-better candidates beyond the tolerance window (reject only regressions). */
acceptImprovements?: boolean, 
/** TODO23 Phase 2: frozen eval-set cases — promotion requires non-regression here. */
frozen?: {
    cases: readonly BakeOffCase[];
    tolerance?: number;
}): BakeOffResult;
export interface SabotageVerdict {
    accepted: boolean;
    violations: string[];
}
/**
 * Bench 14: sabotage gate. Rejects and flags:
 * - un-pinned model digest (supply-chain compromise)
 * - relaxed abstain threshold τ (safety-floor erosion)
 * - disabled injection head (fail-closed removal)
 */
export declare function validateHeadCandidate(candidate: HeadCandidateSpec, incumbent?: HeadCandidateSpec): SabotageVerdict;
/** Head swap = MEDIUM risk; SandboxValidator has no automated checks → held for review. */
export declare function buildHeadSwapProposal(candidate: HeadCandidateSpec, bakeOff: BakeOffResult): SelfImprovementProposal;
/** Sabotage attempt → HIGH risk proposal so the router can never auto-apply it. */
export declare function buildSabotageFlag(candidate: HeadCandidateSpec, violations: readonly string[]): SelfImprovementProposal;
export {};
//# sourceMappingURL=distill.d.ts.map