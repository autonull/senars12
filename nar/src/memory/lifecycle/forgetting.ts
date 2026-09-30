import { maxBy, minBy } from '@senars/util';

import type { Concept } from '../concept.js';
import type { MemoryScorer } from '../pressure/scorer.js';

export type ForgettingPolicy =
  | 'fifo'
  | 'lowest-priority'
  | 'forgetting-curve'
  | { type: 'age'; maxAgeMs: number }
  | { type: 'composite'; weights: { priority: number; age: number } };

const getLastAccess = (concept: Concept): number =>
  'lastAccessedAt' in concept ? (concept.lastAccessedAt ?? 0) : 0;

export class Forgetting {
  private readonly policySelectors: Record<
    string,
    (concepts: Concept[], scorer: MemoryScorer) => Concept | undefined
  > = {
    fifo: (concepts) => minBy(concepts, getLastAccess),
    'lowest-priority': (concepts) => minBy(concepts, (c) => c.priority),
    'forgetting-curve': (concepts, scorer) => this.selectByForgettingCurve(concepts, scorer),
    age: (concepts) => this.selectByAge(concepts),
    composite: (concepts, scorer) => this.selectByComposite(concepts, scorer),
  };

  constructor(private readonly policy: ForgettingPolicy = 'fifo') {}

  selectVictim(concepts: Concept[], scorer: MemoryScorer): Concept | undefined {
    if (concepts.length === 0) return undefined;
    return this.policySelectors[typeof this.policy === 'string' ? this.policy : this.policy.type]?.(
      concepts,
      scorer
    );
  }

  private selectByForgettingCurve(concepts: Concept[], scorer: MemoryScorer): Concept | undefined {
    if (concepts.length === 0) return undefined;
    // Ebbinghaus curve: retrievability = e^(-t / S). Forget the lowest.
    // t = elapsed seconds, floored so the exponent never divides by zero;
    // S = memory strength, floored and scaled to 1-100.
    const now = Date.now();
    return minBy(concepts, (c) => {
      const t = Math.max(0.1, (now - getLastAccess(c)) / 1000);
      const s = Math.max(0.01, scorer.scoreForForgetting(c) * 100);
      return Math.exp(-t / s);
    });
  }

  private selectByAge(concepts: Concept[]): Concept | undefined {
    const { maxAgeMs } = this.policy as { type: 'age'; maxAgeMs: number };
    const now = Date.now();
    return (
      concepts.find((c) => now - getLastAccess(c) > maxAgeMs) ?? minBy(concepts, getLastAccess)
    );
  }

  private selectByComposite(concepts: Concept[], scorer: MemoryScorer): Concept | undefined {
    const { weights } = this.policy as {
      type: 'composite';
      weights: { priority: number; age: number };
    };
    const now = Date.now();
    return maxBy(
      concepts,
      (c) => scorer.score(c) * weights.priority + (now - getLastAccess(c)) * weights.age
    );
  }
}
