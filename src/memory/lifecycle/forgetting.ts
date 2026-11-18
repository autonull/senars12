import { type EvictByScore, victimBy } from '@senars/util';

import type { Concept } from '../concept.js';

export type ForgettingPolicy = 'fifo' | 'lowest-priority';

const getLastAccess = (concept: Concept): number =>
  'lastAccessedAt' in concept ? (concept.lastAccessedAt ?? 0) : 0;

/**
 * Forget policy → eviction order, in the shape every other bounded container
 * declares its own in: `lowest-priority` is the `{ by }` scorer the link layers
 * and the bag read, not a second spelling of "the weakest one loses".
 *
 * A policy *is* a scorer; `victimBy` is {@link minBy} over the live set, so
 * emptiness is its answer and no policy has to handle it.
 */
const victimByPolicy: Record<ForgettingPolicy, EvictByScore<Concept>> = {
  fifo: { by: getLastAccess },
  'lowest-priority': { by: (c) => c.priority },
};

export class Forgetting {
  constructor(private readonly policy: ForgettingPolicy = 'fifo') {}

  selectVictim(concepts: Iterable<Concept>): Concept | undefined {
    return victimBy(concepts, victimByPolicy[this.policy]);
  }
}
