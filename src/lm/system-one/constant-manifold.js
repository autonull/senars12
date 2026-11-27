import { makeId } from '@senars/util/id';
import { validateBatchQueries } from './algebra';
import { composeProposition, dominantDistribution } from './distribution';
import { NO_COST } from './types';
/** One constant-table manifold covers the tier-0 deterministic and tier-3 symbolic stubs (G3/X5). */
export class ConstantManifold {
    #config;
    constructor(config) {
        this.#config = config;
    }
    async judgeBatch(_sharedContext, queries, _budget) {
        validateBatchQueries(queries);
        return queries.map((q) => this.#judge(q));
    }
    async consensus(_sharedContext, query, _k, _budget) {
        validateBatchQueries([query]);
        return { proposition: this.#judge(query), agreement: 1.0, independent: true };
    }
    health() {
        return {
            backendId: this.#config.backendId,
            ready: true,
            breakerOpen: false,
            rollingEce: this.#config.ece,
            queueDepth: 0,
        };
    }
    #judge(query) {
        const { backendId, modelDigest, calibrationVersion, topP, ece, latencyMs, tier } = this.#config;
        return composeProposition(query, {
            queryId: makeId(),
            backendId,
            modelDigest,
            calibration: { version: calibrationVersion, ece },
            latencyMs,
            cost: { ...NO_COST, computeMs: latencyMs },
            tier,
            abstained: false,
        }, query.kind === 'classify'
            ? { kind: 'classify', distribution: dominantDistribution(query.space, topP, 0) }
            : { kind: 'evaluate', score: 0.5 });
    }
}
const DETERMINISTIC_CONFIG = {
    tier: 0,
    backendId: 'deterministic-tier0',
    modelDigest: 'sha256:deterministic',
    calibrationVersion: 'v1.0.0',
    topP: 1.0,
    ece: 0.0,
    latencyMs: 0,
};
const SYMBOLIC_CONFIG = {
    tier: 3,
    backendId: 'symbolic-tier3',
    modelDigest: 'sha256:symbolic',
    calibrationVersion: 'v1.0.0',
    topP: 0.8,
    ece: 0.05,
    latencyMs: 1,
};
export class DeterministicManifold extends ConstantManifold {
    constructor() {
        super(DETERMINISTIC_CONFIG);
    }
}
export class Tier3SymbolicManifold extends ConstantManifold {
    constructor() {
        super(SYMBOLIC_CONFIG);
    }
}
