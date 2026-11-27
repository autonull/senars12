import { PrefetchTable, proposeFromTable } from './prefetch-table';
import { recordReflexOutcome } from './reflex-label-source';
import { DecisionReadout } from './reflex-readout';
/**
 * Semantic reflex (§7.3): bridges the synchronous `Reflex.propose` contract to
 * the asynchronous Manifold by serving proposals from a judgment table
 * prefetched at the attend stage of the same cycle. Falls back to the
 * incumbent reflex when the table is cold.
 */
export class ManifoldReflex extends DecisionReadout {
    id = 'manifold-reflex';
    #fallback;
    #table = new PrefetchTable();
    #dataset;
    /** CLM disaggregated embeddings: per-action query objects + embedding pointers,
     *  reused across ticks (only the state is re-encoded per step). */
    #actionQueries = new Map();
    constructor(fallback, options) {
        super();
        this.#fallback = fallback;
        this.#dataset = options?.dataset;
    }
    /** Called at the attend stage of the same cycle, before propose. */
    async prefetch(stateId, sharedContext, legalActions, manifold, budget, _observation) {
        const queries = legalActions.map((action) => {
            let cached = this.#actionQueries.get(action);
            if (!cached) {
                cached = {
                    query: {
                        kind: 'evaluate',
                        instruction: `Evaluate value of action ${action}`,
                        rubric: 'reflex_value',
                        axis: 'teleological',
                    },
                };
                this.#actionQueries.set(action, cached);
            }
            return cached.query;
        });
        try {
            const propositions = await manifold.judgeBatch(sharedContext, queries, budget);
            const rows = new Map();
            legalActions.forEach((action, i) => {
                const p = propositions[i];
                if (p && !p.abstained && p.kind === 'evaluate')
                    rows.set(action, p.score);
            });
            this.#table.set(stateId, rows);
        }
        catch {
            // Manifold unavailable — table stays cold, incumbent reflex serves
        }
    }
    /** Synchronous contract honored: reads the prefetch table (consume-once for bounded memory). */
    propose(state, legalActions) {
        const proposals = proposeFromTable({
            id: this.id,
            table: this.#table,
            fallback: this.#fallback,
            state,
            legalActions,
            toProposal: (action, score) => ({
                action,
                value: score,
                confidence: score,
                source: this.id,
            }),
        });
        if (proposals.length > 0) {
            this.decisionLog.record(legalActions.map(String), String(proposals[0].action));
        }
        return proposals;
    }
    learn(event) {
        // Distillation label first (C4/R5): the reflex's own decision becomes a
        // reflex_value training row before the fallback learns.
        if (this.#dataset) {
            recordReflexOutcome(this.#dataset, {
                stateDigest: event.perception?.stateId ?? 'unknown-state',
                action: event.actionExecuted ?? event.actionProposed,
                reward: event.reward,
                source: this.id,
            });
        }
        this.#fallback.learn(event);
    }
}
