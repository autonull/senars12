import { maxBy, minBy } from '@senars/util';

import type { Concept } from '../concept.js';

export type ForgettingPolicy = 'fifo' | 'lowest-priority';

const getLastAccess = (concept: Concept): number =>
  'lastAccessedAt' in concept ? (concept.lastAccessedAt ?? 0) : 0;

export class Forgetting {
  private readonly policySelectors: Record<ForgettingPolicy, (concepts: Concept[]) => Concept | undefined> = {
    fifo: (concepts) => minBy(concepts, getLastAccess),
    'lowest-priority': (concepts) => minBy(concepts, (c) => c.priority),
  };

  constructor(private readonly policy: ForgettingPolicy = 'fifo') {}

  selectVictim(concepts: Concept[]): Concept | undefined {
    if (concepts.length === 0) return undefined;
    return this.policySelectors[this.policy](concepts);
  }
}
