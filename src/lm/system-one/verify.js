/**
 * P2 (TODO19): SDE-style verify cascade + consensus fan-out as a budget knob.
 * Thin compositions over `judgeCascade`, `ConfidenceRouter`, and the manifold's
 * self-consistency `consensus` — no new machinery.
 */
import { budgetRemaining } from '@senars/budget';
import { clamp } from '@senars/util/numeric';
import { sha256Hex } from '@senars/util/hash';
import { stageProvenance } from './decide';
import { HEAD_SPECS } from './head-ontology';
import { judgeCascade, routeConfidence, truthProbability, } from './policy';
/** Stage-2 query space derived from stage-1 uncertainty: evidential support, not
 *  plausibility. The plausibility head answers it on the assertion head's support
 *  scale — read from that spec rather than spelled here, where the two had drifted. */
const VERIFY_LEVELS = HEAD_SPECS.assertion.levels;
const verifyQuery = (statement, p) => ({
    kind: 'evaluate',
    rubric: 'plausibility',
    axis: 'epistemic',
    levels: VERIFY_LEVELS,
    instruction: `Independent verification (stage-1 p=${p.toFixed(2)}): assess evidential support for: ${statement}`,
});
/**
 * SDE-style verify cascade: cheap stage-1 self-eval routes through the
 * confidence bands; the expensive stage-2 verification fires only on
 * `review`/`block` — never re-verifying an `act`.
 */
export async function verifyCascade(judge, sharedContext, statement, bands, budget) {
    const stage1 = truthProbability(statement);
    const inputDigest = sha256Hex(statement);
    const result = await judgeCascade(judge, sharedContext, stage1, (first) => {
        if (first.kind !== 'evaluate' || first.abstained)
            return undefined;
        const p = first.score;
        const decision = routeConfidence(p, bands);
        return decision === 'act' ? undefined : verifyQuery(statement, p);
    }, budget);
    const prop = result.stage1;
    const decision = prop.abstained ? 'abstain' : routeConfidence(prop.score, bands);
    return {
        decision,
        p: prop.abstained ? undefined : prop.score,
        verification: result.stage2,
        provenance: stageProvenance([result.stage1, result.stage2], inputDigest, decision === 'abstain' ? 'abstain' : decision, prop.abstained),
    };
}
/** Fan-out never exceeds the LM-call budget remaining; k≥1 always degrades to a single judgment. */
export const fanoutWithinBudget = (k, budget, charged = 0) => clamp(budgetRemaining(budget, 'llmCalls') - charged, 1, k);
/** Consensus fan-out as a budget knob: the requested k is clamped to remaining budget. */
export async function consensusFanout(judge, sharedContext, query, k, budget, charged = 0) {
    return judge.consensus(sharedContext, query, fanoutWithinBudget(k, budget, charged), budget);
}
