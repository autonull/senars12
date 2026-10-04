import { maxBy, minBy } from '@senars/util';

import type { Concept } from '../concept.js';

export type ForgettingPolicy = 'fifo' | 'lowest-priority';

const getLastAccess = (concept: Concept): number =>
  'lastAccessedAt' in concept ? (concept.lastAccessedAt ?? 0) : 0;

/** A policy is a scoring function over the store; emptiness is `minBy`'s answer. */
const victimBy: Record<ForgettingPolicy, (concepts: Iterable<Concept>) => Concept | undefined> = {
  fifo: (concepts) => minBy(concepts, getLastAccess),
  'lowest-priority': (concepts) => minBy(concepts, (c) => c.priority),
};

export class Forgetting {
  constructor(private readonly policy: ForgettingPolicy = 'fifo') {}

  selectVictim(concepts: Iterable<Concept>): Concept | undefined {
    return victimBy[this.policy](concepts);
  }
}
