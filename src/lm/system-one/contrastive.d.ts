import type { BagItem } from '@senars/bag';
import { cosine } from '@senars/util/similarity';
import type { EmbeddingCache, JudgmentQuery } from './types';
export { cosine as cosineF32 };
/** Domain-level rubric shared by all contrastive consumers (gate, grader, routing). */
export declare const DOMAIN_RUBRIC = "domain";
export type ContrastiveScorerFn = (embedding: Float32Array, rubric?: string) => number | undefined;
/** Rubric a query is judged under (mirrors the manifold's head lookup rule). */
export declare function rubricOf(query: JudgmentQuery): string;
export interface InfoNCECalibration {
    /** Learned logit scale (CLIP-style inverse temperature). */
    scale: number;
    bias: number;
    /** Final mean InfoNCE loss over the fit pairs. */
    loss: number;
}
export interface InfoNCEPair {
    query: Float32Array;
    positive: Float32Array;
    negatives: readonly Float32Array[];
}
/**
 * Bidirectional InfoNCE over frozen embeddings: learns (scale, bias) that
 * separate (query, positive) logits from (query, negative) logits via softmax
 * cross-entropy. Deterministic full-batch SGD; the contrastive analogue of a
 * calibrated decision head with no projection layer.
 */
export declare function fitInfoNCE(pairs: readonly InfoNCEPair[], options?: {
    epochs?: number;
    lr?: number;
    scaleInit?: number;
}): InfoNCECalibration;
export interface ContrastiveMemoryConfig {
    /** Per-rubric exemplar budget (positives get the 60% replay share). */
    maxPerRubric?: number;
    /** Replay mix: fraction of the budget reserved for positives (CLM 40/60). */
    positiveShare?: number;
    /** Zero-shot logit scale before calibration. */
    scale?: number;
    /** Base decay rate for exemplars (per second). Defaults to 0. */
    decayRate?: number;
    /** Base forget rate for exemplars (per second). Defaults to 0. */
    forgetRate?: number;
}
export interface RubricExemplarStats {
    positives: number;
    negatives: number;
    calibrated: boolean;
}
/** Bag item for a stored exemplar (Phase C — AIKR-bounded self-maintenance). */
export interface ExemplarItem extends BagItem {
    kind: 'pos' | 'neg';
    embedding: Float32Array;
}
/**
 * Rubric-scoped contrastive exemplar memory (CLM System One): positives and
 * hard negatives per rubric under a 40/60 replay-mix cap, InfoNCE temperature
 * calibration, and zero-shot cosine scoring for uncalibrated heads.
 */
export declare class ContrastiveMemory {
    #private;
    constructor(config?: ContrastiveMemoryConfig);
    /** Add exemplar texts (embedded via the shared cache) under a rubric; returns added count. */
    add(rubric: string, exemplars: {
        positives?: readonly string[];
        negatives?: readonly string[];
    }, cache: EmbeddingCache): Promise<number>;
    /** Add pre-computed exemplar embeddings directly (for text-redacted sources
     *  like the distillation dataset); returns stored count. */
    addEmbeddings(rubric: string, exemplars: {
        positives?: readonly Float32Array[];
        negatives?: readonly Float32Array[];
    }): number;
    /** Fit InfoNCE scale/bias for a rubric from its stored exemplars (leave-one-out positives). */
    calibrate(rubric: string, options?: {
        epochs?: number;
        lr?: number;
    }): InfoNCECalibration | undefined;
    /** Calibrate every rubric that has both classes; returns fitted rubric ids. */
    calibrateAll(options?: {
        epochs?: number;
        lr?: number;
    }): string[];
    /**
     * Zero-shot/calibrated contrastive score in (0,1): best-positive similarity
     * minus best-negative similarity passed through the learned logit. When no
     * rubric is given, the best score across all stored rubrics is returned
     * (cross-rubric in-domain-ness). Undefined when no exemplars exist.
     */
    score(embedding: Float32Array, rubric?: string): number | undefined;
    /** Max cosine over every stored exemplar — in-domain-ness for OOD routing. */
    routingScore(embedding: Float32Array): number | undefined;
    has(rubric?: string): boolean;
    isEmpty(): boolean;
    stats(): Record<string, RubricExemplarStats>;
    clear(): void;
    /**
     * Phase C: per-cycle decay — stale exemplar priority erodes; items below the
     * forget floor drop out, keeping the pool fresh (flywheel maintenance).
     * @param rate Optional decay rate override for this call (per second).
     */
    decay(rate?: number): void;
    /**
     * Phase C: judgment auto-admission — a high-confidence decision is admitted
     * to the exemplar pool when it improves discrimination margin (flywheel:
     * judgments → exemplars → better calibrated judgments).
     */
    observeJudgment(rubric: string, embedding: Float32Array, judgment: {
        label: 'pos' | 'neg';
        confidence: number;
    }, options?: {
        admitThreshold?: number;
    }): boolean;
    /** Promote pending judgments into the exemplar pool when pressure allows. */
    maintainIfPressured(options?: {
        budget?: number;
    }): Promise<number>;
}
/**
 * Hard-negative proximity per candidate, and the candidates that fell below a
 * verification floor. The decider (which vetoes) and the dispatcher (which only
 * penalizes) each wrote this loop, embedding every candidate and reading the
 * cross-rubric score for it; the copies had already drifted, since only the
 * decider's honoured the floor.
 */
export interface CandidateProximity {
    /** `1 - score` per candidate that could be embedded. */
    readonly penalties: ReadonlyMap<string, number>;
    /** Candidates scoring under `floor`, in candidate order. */
    readonly belowFloor: readonly string[];
}
export declare function candidateProximity(memory: ContrastiveMemory | null | undefined, cache: EmbeddingCache | null | undefined, candidates: readonly string[], floor?: number): Promise<CandidateProximity>;
export declare function createContrastiveMemory(config?: ContrastiveMemoryConfig): ContrastiveMemory;
//# sourceMappingURL=contrastive.d.ts.map