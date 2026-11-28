/** The running estimate for one `(state, action)` pair. */
export interface QEntry {
    /** The estimate itself — reward for a bandit, utility for Q-learning. */
    value: number;
    /** Observations folded into `value`. Also the exploration denominator. */
    count: number;
}
/** A never-updated arm. The zero value is deliberate: the mean of nothing is nothing. */
export declare const UNVISITED: QEntry;
/** How one new target folds into a running estimate. */
export type QUpdate = (entry: QEntry, target: number) => QEntry;
/** The exact running mean: every sample counts equally, so `count` is the weight. */
export declare const meanUpdate: QUpdate;
/** A Q-learning step: move `alpha` of the way toward a bootstrapped target. */
export declare const lerpUpdate: (alpha: number) => QUpdate;
/** Visit count → proposal confidence. Monotone, bounded by 1. */
export type ConfidenceCurve = (count: number) => number;
/** Confidence proportional to visits, saturating at `scale`. */
export declare const visitConfidence: (scale: number) => ConfidenceCurve;
/** Confidence on the saturating exponential ramp, for estimators whose early
 *  estimates are worth more than a linear ramp admits. */
export declare const rampConfidence: (scale: number) => ConfidenceCurve;
/** Turns an estimate into a proposal score. */
export type Exploration = (entry: QEntry, totalVisits: number) => number;
/** No exploration at all: the proposal score is the estimate. */
export declare const greedy: Exploration;
/**
 * UCB1: the estimate plus `c · sqrt(ln(total) / count)`. `untried` is what an
 * arm nobody has pulled scores — `Infinity` for a strict maximum, a finite
 * floor where an untouched arm must still lose to a proven one.
 */
export declare const ucb: (c: number, untried?: number) => Exploration;
/**
 * A sparse `(state, action) -> QEntry` table with a running observation count.
 *
 * Reads never materialize: `propose`/`select` walk states an agent may never
 * reach, so a read that inserted would let selection alone grow the table
 * without bound.
 *
 * This is the tabular-bandit substrate every policy in the repository is built
 * on, with the four decisions a bandit makes — where the estimate comes from,
 * how a new observation folds into it, how many visits become confidence, and
 * how an estimate becomes a proposal score — supplied as swappable pieces. A
 * fix to the update rule, the confidence curve or the exploration term must
 * therefore reach the reflex, the tabular Q-learner, the manifold RL agent and
 * the benchmark arms at once. Four hand-rolled Q-tables is how those drifted.
 */
export declare class QTable {
    #private;
    private readonly update;
    constructor(update?: QUpdate);
    /** Observations across every arm. The `totalVisits` argument of {@link ucb}. */
    get totalVisits(): number;
    /** The estimate, or {@link UNVISITED} — without inserting anything. */
    read(state: string, action: string): QEntry;
    /** Folds `target` into the estimate and counts the observation. */
    observe(state: string, action: string, target: number): QEntry;
    /**
     * Folds `target` into the estimate without counting it as an observation.
     * For bootstrapped targets (a Q-learning update consumes a reward and a
     * successor estimate, but is one observation of the pair, not two).
     */
    revise(state: string, action: string, target: number): QEntry;
    /** Counts an observation without changing the estimate — for a policy whose
     *  reward arrives out of band, or which records exposure alone. */
    visit(state: string, action: string): number;
    /** The best-scoring arm of `state`, or `undefined` when it has no arms. */
    best(state: string, score?: Exploration): QEntry | undefined;
    /** Every arm of `state`, materialized or not. */
    arms(state: string): ReadonlyMap<string, QEntry>;
    clear(): void;
    /** The table as plain JSON — the shape persistence and cross-process tests need. */
    toJSON(): Record<string, Record<string, QEntry>>;
    /** Restores a {@link toJSON} snapshot. The estimator policy is unchanged. */
    loadJSON(snapshot: Record<string, Record<string, QEntry>>): void;
}
/** True when an arm has been pulled few enough times to still be worth trying. */
export declare const isYoung: (entry: QEntry, youngVisits: number) => boolean;
//# sourceMappingURL=bandit.d.ts.map