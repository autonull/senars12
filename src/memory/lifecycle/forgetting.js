import { victimBy } from '@senars/util/collections';
const getLastAccess = (concept) => 'lastAccessedAt' in concept ? (concept.lastAccessedAt ?? 0) : 0;
/**
 * Forget policy → eviction order, in the shape every other bounded container
 * declares its own in: `lowest-priority` is the `{ by }` scorer the link layers
 * and the bag read, not a second spelling of "the weakest one loses".
 *
 * A policy *is* a scorer; `victimBy` is {@link minBy} over the live set, so
 * emptiness is its answer and no policy has to handle it.
 */
const victimByPolicy = {
    fifo: { by: getLastAccess },
    'lowest-priority': { by: (c) => c.priority },
};
export class Forgetting {
    policy;
    constructor(policy = 'fifo') {
        this.policy = policy;
    }
    selectVictim(concepts) {
        return victimBy(concepts, victimByPolicy[this.policy]);
    }
}
