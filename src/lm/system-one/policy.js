/**
 * Jev-inspired decision-API utilities (§0.4, Phase E):
 * `truthProbability` (probability-of-truth — Jev `Noul`), `ConfidenceRouter` (act/review/block bands),
 * `compositeScore` (normalized weighted aggregation), `judgeCascade`
 * (two-stage dependency). Code owns composition — weights are declared, never learned.
 */
import { BANDS } from '@senars/util/cognitive-schemas';
import { renormalize, sumBy } from '@senars/util/numeric';
import { assertDefined } from '@senars/util/assert';
import { HEAD_SPECS } from './head-ontology';
/** Jev `Noul`: an Evaluate over the boolean anchor pair, read off the head that owns it. */
export function truthProbability(statement) {
    const { rubric, axis, levels } = HEAD_SPECS.plausibility;
    return {
        kind: 'evaluate',
        rubric,
        axis,
        levels,
        instruction: `Probability the statement is true: ${statement}`,
    };
}
/** Extracts P(true) from a `truthProbability` proposition; undefined when it abstained. */
export function truthProbabilityOf(p) {
    return p.abstained ? undefined : p.score;
}
/**
 * The graded rungs, most permissive first: every band but `abstain`, read off `BANDS`
 * in ordinal order rather than written out a fourth time. `abstain` has no threshold
 * because it is the answer when the head declined, not a score that routes to it.
 */
const RUNGS = Object.entries(BANDS)
    .filter((entry) => entry[0] !== 'abstain')
    .toSorted((a, b) => b[1] - a[1])
    .map(([band]) => band);
/** The routing bands a router gets when nothing else says: `act` is the top rung, so
 *  it is also the threshold at which a decision is no longer in doubt — which is why
 *  the decider's safety-floor short-circuit and the pipeline's band table both read
 *  it rather than restating a number. */
export const DEFAULT_CONFIDENCE_BANDS = { act: 0.8, review: 0.5, block: 0 };
/** Monotone band routing: the first rung whose threshold `p` clears, else `block`. */
export const routeConfidence = (p, bands) => RUNGS.find((rung) => p >= bands[rung]) ?? 'block';
/** True iff `candidate` can only restrict relative to `incumbent` (monotonicity). */
export const isRestrictive = (candidate, incumbent) => RUNGS.every((rung) => candidate[rung] >= incumbent[rung]);
/**
 * Confidence-gated routing (Jev pattern): maps calibrated confidence to
 * act/review/block bands. A router may only restrict — never promote a
 * proposition past a looser router's decision.
 */
export class ConfidenceRouter {
    bands;
    constructor(bands) {
        this.bands = bands;
    }
    /** Default router equivalent to the legacy bare-`p < τ` split (block never fires). */
    static fromThreshold(threshold) {
        return new ConfidenceRouter({ act: threshold, review: 0, block: 0 });
    }
    route(input) {
        if (typeof input === 'number')
            return routeConfidence(input, this.bands);
        if (input.abstained)
            return 'abstain';
        return routeConfidence(input.top?.p ?? input.score ?? 0, this.bands);
    }
}
/**
 * Normalized weighted aggregation (Jev composite scoring): weights are declared
 * config, re-normalized over the non-abstained entries. All abstained ⇒ undefined.
 */
export function compositeScore(entries, weights) {
    const contributions = renormalize(entries.filter((e) => !e.abstained), (e) => weights[e.key] ?? 0, (e, weight) => ({ key: e.key, weight, p: e.p }), []);
    if (!contributions.length)
        return undefined;
    return { score: sumBy(contributions, (c) => c.weight * c.p), contributions };
}
/**
 * Two-stage dependency / hierarchical classification (Jev pattern): stage-2's
 * query space is derived from stage-1's resolved top.
 */
export async function judgeCascade(judge, sharedContext, stage1, stage2Factory, budget) {
    const [first] = await judge.judgeBatch(sharedContext, [stage1], budget);
    const stage1Result = assertDefined(first, 'judgeCascade: stage-1 produced no proposition');
    const stage2 = stage2Factory(stage1Result);
    if (!stage2)
        return { stage1: stage1Result };
    const [second] = await judge.judgeBatch(sharedContext, [stage2], budget);
    return { stage1: stage1Result, stage2: second };
}
