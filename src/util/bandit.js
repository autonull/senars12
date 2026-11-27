import { getOrInsert, maxBy } from './collections';
import { clamp01, lerp, saturationRamp, ucb1 } from './numeric';
/** A never-updated arm. The zero value is deliberate: the mean of nothing is nothing. */
export const UNVISITED = Object.freeze({ value: 0, count: 0 });
/** The row of a state nobody has pulled from. Shared, because it is never written. */
const NO_ARMS = new Map();
/** The exact running mean: every sample counts equally, so `count` is the weight. */
export const meanUpdate = (entry, target) => entry.count > 0
    ? { value: (entry.value * entry.count + target) / (entry.count + 1), count: entry.count + 1 }
    : { value: target, count: 1 };
/** A Q-learning step: move `alpha` of the way toward a bootstrapped target. */
export const lerpUpdate = (alpha) => (entry, target) => ({ value: lerp(entry.value, target, alpha), count: entry.count + 1 });
/** Confidence proportional to visits, saturating at `scale`. */
export const visitConfidence = (scale) => (count) => clamp01(count / scale);
/** Confidence on the saturating exponential ramp, for estimators whose early
 *  estimates are worth more than a linear ramp admits. */
export const rampConfidence = (scale) => (count) => saturationRamp(count, scale);
/** No exploration at all: the proposal score is the estimate. */
export const greedy = (entry) => entry.value;
/**
 * UCB1: the estimate plus `c · sqrt(ln(total) / count)`. `untried` is what an
 * arm nobody has pulled scores — `Infinity` for a strict maximum, a finite
 * floor where an untouched arm must still lose to a proven one.
 */
export const ucb = (c, untried = Number.POSITIVE_INFINITY) => (entry, totalVisits) => entry.count === 0 ? untried : ucb1(entry.value, entry.count, totalVisits, c);
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
export class QTable {
    update;
    #rows = new Map();
    #totalVisits = 0;
    constructor(update = meanUpdate) {
        this.update = update;
    }
    /** Observations across every arm. The `totalVisits` argument of {@link ucb}. */
    get totalVisits() {
        return this.#totalVisits;
    }
    /** The estimate, or {@link UNVISITED} — without inserting anything. */
    read(state, action) {
        return this.#rows.get(state)?.get(action) ?? UNVISITED;
    }
    /** Folds `target` into the estimate and counts the observation. */
    observe(state, action, target) {
        const entry = this.update(this.read(state, action), target);
        const row = this.#rowFor(state);
        row.set(action, entry);
        this.#totalVisits++;
        return entry;
    }
    /**
     * Folds `target` into the estimate without counting it as an observation.
     * For bootstrapped targets (a Q-learning update consumes a reward and a
     * successor estimate, but is one observation of the pair, not two).
     */
    revise(state, action, target) {
        const entry = this.update(this.read(state, action), target);
        this.#rowFor(state).set(action, entry);
        return entry;
    }
    /** Counts an observation without changing the estimate — for a policy whose
     *  reward arrives out of band, or which records exposure alone. */
    visit(state, action) {
        const row = this.#rowFor(state);
        const { value, count } = row.get(action) ?? UNVISITED;
        row.set(action, { value, count: count + 1 });
        this.#totalVisits++;
        return count + 1;
    }
    #rowFor(state) {
        return getOrInsert(this.#rows, state, () => new Map());
    }
    /** The best-scoring arm of `state`, or `undefined` when it has no arms. */
    best(state, score = greedy) {
        return maxBy(this.arms(state).values(), (entry) => score(entry, this.#totalVisits));
    }
    /** Every arm of `state`, materialized or not. */
    arms(state) {
        return this.#rows.get(state) ?? NO_ARMS;
    }
    clear() {
        this.#rows.clear();
        this.#totalVisits = 0;
    }
    /** The table as plain JSON — the shape persistence and cross-process tests need. */
    toJSON() {
        const out = {};
        for (const [state, row] of this.#rows) {
            const arms = {};
            for (const [action, entry] of row)
                arms[action] = { value: entry.value, count: entry.count };
            out[state] = arms;
        }
        return out;
    }
    /** Restores a {@link toJSON} snapshot. The estimator policy is unchanged. */
    loadJSON(snapshot) {
        this.clear();
        for (const [state, arms] of Object.entries(snapshot)) {
            const row = new Map();
            for (const [action, entry] of Object.entries(arms)) {
                row.set(action, { value: entry.value, count: entry.count });
                this.#totalVisits += entry.count;
            }
            this.#rows.set(state, row);
        }
    }
}
/** True when an arm has been pulled few enough times to still be worth trying. */
export const isYoung = (entry, youngVisits) => entry.count < youngVisits;
