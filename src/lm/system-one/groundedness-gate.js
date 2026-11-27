import { createDecider } from './decide';
import { createSystemOneBudget } from './types';
const S1_BUDGET = createSystemOneBudget();
const GROUNDEDNESS_QUERY = {
    kind: 'evaluate',
    instruction: 'Evaluate if the narration is grounded in evidence',
    rubric: 'groundedness',
    axis: 'epistemic',
    criticality: 'standard',
};
/**
 * Egress gate over the unified decision facade (TODO23): one `decide()` call
 * composes the calibrated groundedness head with the CLM contrastive fallback
 * (positive = grounded, negative = error episodes).
 */
export function createGroundednessGate(options) {
    const { manifold, embeddingCache, threshold = 0.7, getContrastive } = options;
    return async (narration, correlationId) => {
        try {
            const contrastive = getContrastive?.(correlationId);
            const decider = createDecider({
                judge: (pointer, queries, budget) => manifold.judgeBatch(pointer, queries, budget),
                embeddingCache,
                contrastive,
            });
            const result = await decider.decide({
                context: narration,
                queries: [GROUNDEDNESS_QUERY],
                budget: S1_BUDGET,
                contrastiveRubric: 'groundedness',
            });
            const proposition = result.verdicts[0]?.proposition;
            if (proposition && !proposition.abstained && proposition.kind === 'evaluate') {
                return { grounded: proposition.score >= threshold, score: proposition.score };
            }
            // CLM contrastive fallback: abstained head ⇒ zero-shot entailment score.
            if (result.contrastive.score !== undefined) {
                return { grounded: result.contrastive.score >= threshold, score: result.contrastive.score };
            }
            return { grounded: false, score: 0 };
        }
        catch {
            return { grounded: false, score: 0 };
        }
    };
}
