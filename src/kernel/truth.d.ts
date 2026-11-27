/**
 * Kernel Truth — the NAL truth algebra.
 *
 * Truth values are pairs (f, c) where:
 * - f = frequency [0,1]: proportion of positive evidence
 * - c = confidence [0,1]: amount of evidence relative to horizon
 *
 * All operations saturate at boundaries; no operation throws on valid input.
 */
import type { Frequency, Confidence, TruthLike } from './types';
export type { TruthValue } from './types';
/** Truth value type. */
export type Truth = {
    readonly f: Frequency;
    readonly c: Confidence;
};
/** Normalize a truth value to valid domain. */
export declare const normalizeTruth: (f: number, c: number) => Truth;
/** Alias for normalizeTruth (test compatibility). */
export declare const normalize: typeof normalizeTruth;
/** Create a truth value with validation. */
export declare const createTruth: (f: number, c: number) => Truth;
/** Truth constants. */
export declare const Truth: {
    readonly TRUE: Truth;
    readonly FALSE: Truth;
    readonly NEUTRAL: Truth;
    readonly MAX_CONFIDENCE: number;
    readonly WEAKENING_FACTOR: number;
    readonly fromUnknown: (t: TruthLike | undefined, fallback?: Truth) => Truth;
    readonly create: (f: number, c: number) => Truth;
    readonly normalize: (f: number, c: number) => Truth;
    readonly negation: (t: Truth) => Truth;
    readonly conversion: (t: Truth) => Truth;
    readonly attention: (t: Truth) => number;
    readonly expectation: (t: Truth) => number;
    readonly harshness: (t: Truth) => number;
    readonly analogy: (t1: Truth, t2: Truth) => Truth;
    readonly resemblance: (t1: Truth, t2: Truth) => Truth;
    readonly intersection: (t1: Truth, t2: Truth) => Truth;
    readonly union: (t1: Truth, t2: Truth) => Truth;
    readonly conjunction: (t1: Truth, t2: Truth) => Truth;
    readonly disjunction: (t1: Truth, t2: Truth) => Truth;
    readonly deduction: (t1: Truth, t2: Truth) => Truth;
    readonly deductionWeak: (t1: Truth, t2: Truth) => Truth | null;
    readonly induction: (t1: Truth, t2: Truth) => Truth;
    readonly abduction: (t1: Truth, t2: Truth) => Truth;
    readonly detachment: (t1: Truth, t2: Truth) => Truth;
    readonly revision: (t1: Truth, t2: Truth) => Truth;
    readonly revisionWeak: (t1: Truth, t2: Truth) => Truth;
    readonly choice: (t1: Truth, t2: Truth) => Truth;
    readonly structuralDeduction: (t: Truth) => Truth;
    readonly structuralReduction: (t: Truth) => Truth;
    readonly damp: (t: Truth, factor: number) => Truth;
    readonly reinforce: (t: Truth) => Truth;
    readonly contradict: (t: Truth) => Truth;
    readonly isStronger: (t1: Truth, t2: Truth) => boolean;
    readonly weak: (c: number) => number;
    readonly c2w: (c: number) => number;
    readonly w2c: (w: number) => number;
    readonly serialize: (t: Truth) => string;
    readonly format: (t: Truth, fractionDigits?: number) => string;
    readonly deserialize: (s: string) => Truth | null;
    readonly equals: (t1: Truth, t2: Truth, epsilon?: number) => boolean;
    readonly compare: (t1: Truth, t2: Truth) => number;
    readonly deductionChain: (t1: Truth, t2: Truth, steps: number) => Truth;
    readonly inductionChain: (t1: Truth, t2: Truth, steps: number, independence?: 'independent' | 'dependent' | 'unknown') => Truth;
    readonly abductionChain: (t1: Truth, t2: Truth, steps: number, independence?: 'independent' | 'dependent' | 'unknown') => Truth;
    readonly conversionChain: (t: Truth, steps: number) => Truth;
};
/** Type for truth operations. */
export type TruthOp = 'negation' | 'conversion' | 'analogy' | 'resemblance' | 'intersection' | 'union' | 'deduction' | 'deductionWeak' | 'induction' | 'abduction' | 'detachment' | 'revision' | 'revisionWeak' | 'choice' | 'structuralDeduction' | 'structuralReduction' | 'damp' | 'reinforce' | 'contradict';
/** Get truth operation by name. */
export declare function getTruthOp(name: TruthOp): (t1: Truth, t2?: Truth, ...args: unknown[]) => Truth | null | number;
/** Truth table for binary operations (for verification). */
export interface TruthTableEntry {
    op: TruthOp;
    t1: Truth;
    t2: Truth;
    result: Truth | null;
}
/** Generate truth table for an operation. */
export declare function generateTruthTable(op: TruthOp, steps?: number): TruthTableEntry[];
/** Verify truth algebra laws. */
export declare function verifyTruthLaws(): {
    law: string;
    holds: boolean;
    counterexample?: unknown;
}[];
//# sourceMappingURL=truth.d.ts.map