import { sha256Hex } from '@senars/util/hash';
import { rankBy } from '@senars/util/collections';
import { stageProvenance } from './decide';
import { PrefetchTable, proposeFromTable } from './prefetch-table';
const COARSE_QUERY = (action) => ({
    kind: 'evaluate',
    instruction: `Coarse feasibility of placement ${action}`,
    rubric: 'feasibility',
    axis: 'teleological',
});
const FINE_QUERY = (action) => ({
    kind: 'evaluate',
    instruction: `Fine value of placement ${action}`,
    rubric: 'reflex_value',
    axis: 'teleological',
});
export class PlacementCascadeReflex {
    id = 'placement-cascade';
    topK;
    #fallback;
    #table = new PrefetchTable();
    constructor(fallback, options = {}) {
        this.#fallback = fallback;
        this.topK = options.topK ?? 8;
    }
    /** Called at the attend stage of the same cycle, before propose. */
    async prefetch(stateId, sharedContext, legalActions, manifold, budget) {
        try {
            // Stage-1: one batched coarse rank over the whole set.
            const coarse = await manifold.judgeBatch(sharedContext, legalActions.map(COARSE_QUERY), budget);
            const ranked = rankBy(legalActions.map((action, i) => {
                const p = coarse[i];
                return { i, action, p: p && !p.abstained && p.kind === 'evaluate' ? p.score : -1 };
            }), (r) => r.p);
            if (ranked.length <= this.topK) {
                const rows = new Map();
                for (const r of ranked) {
                    const prop = coarse[r.i];
                    const provenance = stageProvenance([prop, undefined], sha256Hex(r.action), 'act', !prop || prop.abstained);
                    rows.set(r.action, { score: r.p, provenance });
                }
                this.#table.set(stateId, rows);
                return;
            }
            // Stage-2: fine reflex_value on the top-K only (cascade dependency).
            const topK = ranked.slice(0, this.topK);
            const topKActions = topK.map((r) => r.action);
            const fine = await manifold.judgeBatch(sharedContext, topKActions.map(FINE_QUERY), budget);
            const rows = new Map();
            topK.forEach((r, i) => {
                const p = fine[i];
                if (p && !p.abstained && p.kind === 'evaluate') {
                    const { action } = r;
                    const coarseProp = coarse[r.i];
                    const provenance = stageProvenance([coarseProp, p], sha256Hex(action), 'act', false);
                    rows.set(action, { score: p.score, provenance });
                }
            });
            this.#table.set(stateId, rows);
        }
        catch {
            // Manifold unavailable — table stays cold, incumbent reflex serves
        }
    }
    /** Synchronous contract honored: reads the prefetch table (consume-once). */
    propose(state, legalActions) {
        return proposeFromTable({
            id: this.id,
            table: this.#table,
            fallback: this.#fallback,
            state,
            legalActions,
            toProposal: (action, entry) => ({
                action,
                value: entry.score,
                confidence: entry.score,
                source: this.id,
                provenance: entry.provenance,
            }),
        });
    }
    learn(event) {
        this.#fallback.learn(event);
    }
}
