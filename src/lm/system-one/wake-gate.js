import { HEAD_SPECS, specToQuery } from './head-ontology';
import { createSystemOneBudget } from './types';
const DEFAULT_BUDGET = createSystemOneBudget();
const relevanceQuery = specToQuery(HEAD_SPECS.relevance);
/**
 * E5 wake gate (Jev wake pattern): before a timer/consolidation-driven wake,
 * judge the sleep note with the `relevance` head — one evaluate per note.
 * User input always wakes without a judgment. Unfitted/abstaining heads and
 * manifold failure fail open (`wake`) — timers waking is the pre-gate behavior,
 * so uncertainty must never stall a sleeping agent.
 */
export function createWakeGate(options) {
    const { manifold, embeddingCache, budget = DEFAULT_BUDGET, wakeThreshold = 0.7, notYetThreshold = 0.4, dataset, source = 'wake-gate', } = options;
    return async (sleepNote, hint = {}) => {
        if (hint.userInput) {
            return { decision: 'wake', abstained: false, reason: 'user-input' };
        }
        let pointer;
        try {
            pointer = (await embeddingCache.write(sleepNote));
            const [prop] = await manifold.judgeBatch(pointer, [relevanceQuery], budget);
            if (prop?.kind !== 'evaluate') {
                return { decision: 'wake', abstained: true, reason: 'no-relevance-proposition' };
            }
            const relevance = prop;
            if (prop.calibration.fitted !== true) {
                return { decision: 'wake', abstained: relevance.abstained, reason: 'unfitted' };
            }
            if (relevance.abstained) {
                return { decision: 'wake', abstained: true, reason: 'abstain' };
            }
            const decision = relevance.score >= wakeThreshold
                ? 'wake'
                : relevance.score >= notYetThreshold
                    ? 'not_yet'
                    : 'unrelated';
            if (dataset) {
                const label = {
                    evidenceId: `wake::${pointer}`,
                    rubric: HEAD_SPECS.relevance.rubric,
                    axis: HEAD_SPECS.relevance.axis,
                    label: decision,
                    score: relevance.score,
                    source,
                };
                dataset.record(label);
            }
            return { decision, score: relevance.score, abstained: false, reason: 'relevance' };
        }
        catch {
            return { decision: 'wake', abstained: true, reason: 'manifold-unavailable' };
        }
    };
}
