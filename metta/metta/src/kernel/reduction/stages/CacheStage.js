import {ReductionStage} from './ReductionStage.js';

export class CacheStage extends ReductionStage {
    constructor() {
        super('cache');
    }

    process(atom, context) {
        if (!context.config?.get('caching') || !context.cache) {
            return null;
        }
        if (typeof atom === 'string' || typeof atom === 'number') {
            return null;
        }
        const cached = context.cache.get(atom);
        return cached !== undefined ? {reduced: cached, applied: true, stage: 'cache', cached: true} : null;
    }
}
