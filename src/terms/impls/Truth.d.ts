import { type Confidence, type Frequency, type TruthLike } from '@senars/types/truth';
export interface Truth {
    readonly f: Frequency;
    readonly c: Confidence;
}
/**
 * Bring a value into the `Truth` domain: frequency in `0..1`, confidence in
 * `0..MAX_CONFIDENCE`, non-numeric input replaced by the unopinionated default
 * (`0.5`/`0.9`).
 *
 * Total by construction. This is what every rule op and every untrusted
 * boundary routes through, because the algebra saturates by design — a
 * confidence-weighted merge can exceed the cap, a saturating revision reaches
 * it — and a throw in the middle of a rule would abort a derivation over a
 * value the rule was always going to clamp.
 */
declare const normalizeTruth: (f: number, c: number) => Truth;
/**
 * The validating constructor: a confidence above the ceiling is a caller that
 * did not mean to produce it, not a value to be absorbed. Held separately from
 * {@link normalizeTruth} so that distinction survives — callers reading a
 * number off the wire, a schema, or a model reply use {@link Truth.normalize}.
 */
declare const createTruth: (f: number, c: number) => Truth;
export type IndependenceStatus = 'independent' | 'dependent' | 'unknown';
export declare const Truth: {
    readonly create: typeof createTruth;
    readonly normalize: typeof normalizeTruth;
    readonly fromUnknown: (t: TruthLike | undefined, fallback?: Truth) => Truth;
    readonly TRUE: Truth;
    readonly FALSE: Truth;
    readonly NEUTRAL: Truth;
    readonly MAX_CONFIDENCE: 0.999;
    readonly negation: (t: Truth) => Truth;
    readonly conversion: (t: Truth) => Truth;
    /**
     * Salience: how much attention a truth earns, as `f · c`. This is the ordering
     * key for bags, budgets, and relevance gates — not a claim about how true
     * something is.
     *
     * It is deliberately not {@link Truth.expectation} and must never be read as
     * one. `expectation` is `c · (f - 0.5) + 0.5`, so it is signed around the
     * neutral midpoint and separates "I am certain it is false" from "I know
     * nothing"; `attention` collapses both, scoring `(f=0.50, c=0.80)` and
     * `(f=0.80, c=0.50)` identically. Ranking by it is right — a confidently-false
     * belief deserves attention too. Reporting it as confidence is wrong.
     */
    readonly attention: (t: Truth) => number;
    readonly expectation: (t: Truth) => number;
    readonly harshness: (t: Truth) => number;
    readonly comparison: (t1: Truth, t2: Truth) => Truth;
    readonly analogy: (t1: Truth, t2: Truth) => Truth;
    readonly resemblance: (t1: Truth, t2: Truth) => Truth;
    readonly contraposition: (t1: Truth, t2: Truth) => Truth;
    readonly intersection: (t1: Truth, t2: Truth) => Truth;
    readonly union: (t1: Truth, t2: Truth) => Truth;
    readonly subtract: (t1: Truth, t2: Truth) => Truth;
    readonly diff: (t1: Truth, t2: Truth) => Truth;
    readonly exemplification: (t1: Truth, t2: Truth) => Truth;
    readonly sameness: (t1: Truth, t2: Truth) => Truth;
    readonly deduction: (t1: Truth, t2: Truth) => Truth;
    readonly deductionWeak: (t1: Truth, t2: Truth) => Truth | null;
    readonly induction: (t1: Truth, t2: Truth) => Truth;
    readonly abduction: (t1: Truth, t2: Truth) => Truth;
    readonly detachment: (t1: Truth, t2: Truth) => Truth;
    readonly revision: (t1: Truth, t2: Truth) => Truth;
    readonly choice: (t1: Truth, t2: Truth) => Truth;
    readonly structuralDeduction: (t: Truth) => Truth;
    readonly structuralReduction: (t: Truth) => Truth;
    readonly revisionWeak: (t1: Truth, t2: Truth) => Truth;
    /**
     * Confidence decay by `factor`, frequency unchanged. Ageing a belief and
     * weakening a hypothetical both scale how much the evidence is worth while
     * leaving what it says alone.
     *
     * Distinct from {@link Truth.weak}, which is the NAL weakening rule
     * `c / (c + 10)` — a principled reduction, not a decay rate.
     */
    readonly damp: (t: Truth, factor: number) => Truth;
    /**
     * Outcome nudges from the feedback loop, not inference rules: a confirmed or
     * contradicted prediction shifts the belief and adds confidence, because a
     * checkable verdict is itself evidence.
     *
     * Heuristic by construction. A `c` already at the ceiling simply does not
     * move: `reinforce` and `contradict` land in {@link Truth.normalize}, so
     * `c + OUTCOME_GAIN` on a `0.9` belief saturates at
     * {@link Truth.MAX_CONFIDENCE} rather than escaping as `1.0` and failing the
     * domain check inside a feedback turn.
     */
    readonly reinforce: (t: Truth) => Truth;
    readonly contradict: (t: Truth) => Truth;
    readonly isStronger: (t1: Truth, t2: Truth) => boolean;
    readonly weak: (c: number) => number;
    readonly c2w: any;
    readonly w2c: any;
    readonly serialize: (t: Truth) => string;
    readonly format: (t: Truth, fractionDigits?: number) => string;
    readonly deserialize: (s: string) => Truth | null;
    readonly equals: (t1: Truth, t2: Truth, epsilon?: number) => boolean;
    readonly compare: (t1: Truth, t2: Truth) => number;
    readonly deductionChain: (t1: Truth, t2: Truth, steps: number) => Truth;
    readonly inductionChain: (t1: Truth, t2: Truth, steps: number, independence?: IndependenceStatus) => Truth;
    readonly abductionChain: (t1: Truth, t2: Truth, steps: number, independence?: IndependenceStatus) => Truth;
    readonly conversionChain: (t: Truth, steps: number) => Truth;
};
/** The one epsilon-tolerant truth comparison; `Truth.equals` is the member form. */
export declare const isTruthEqual: (a: Truth, b: Truth, epsilon?: number) => boolean;
export {};
//# sourceMappingURL=Truth.d.ts.map