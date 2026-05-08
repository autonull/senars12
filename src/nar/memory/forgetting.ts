import type {Concept} from './concept.js';
import type {MemoryScorer} from './scorer.js';

export type ForgettingPolicy =
  | 'fifo'
  | { type: 'priority'; threshold: number }
  | { type: 'age'; maxAgeMs: number }
  | { type: 'composite'; weights: { priority: number; age: number } };

export class Forgetting {
  private policy: ForgettingPolicy;

  constructor(policy: ForgettingPolicy = 'fifo') {
    this.policy = policy;
  }

  selectVictim(concepts: Concept[], scorer: MemoryScorer): Concept | undefined {
    if (concepts.length === 0) return undefined;

    if (this.policy === 'fifo') {
      let oldest: Concept | undefined;
      let oldestTime = Infinity;
      for (const concept of concepts) {
        const lastAccess = 'lastAccessTime' in concept ? concept.lastAccessTime ?? 0 : 0;
        if (lastAccess < oldestTime) {
          oldestTime = lastAccess;
          oldest = concept;
        }
      }
      return oldest;
    }

    if (typeof this.policy === 'object' && 'type' in this.policy) {
      switch (this.policy.type) {
        case 'priority':
          return this.selectByPriority(concepts);
        case 'age':
          return this.selectByAge(concepts);
        case 'composite':
          return this.selectByComposite(concepts, scorer);
      }
    }

    return concepts[0];
  }

  private selectByPriority(concepts: Concept[]): Concept | undefined {
    const policy = this.policy as { type: 'priority'; threshold: number };
    for (const concept of concepts) {
      if (concept.priority < policy.threshold) {
        return concept;
      }
    }
    return concepts.reduce((min, c) => (min && c.priority < min.priority) ? c : min, concepts[0]);
  }

  private selectByAge(concepts: Concept[]): Concept | undefined {
    const policy = this.policy as { type: 'age'; maxAgeMs: number };
    const now = Date.now();
    for (const concept of concepts) {
      const lastAccess = 'lastAccessTime' in concept ? concept.lastAccessTime ?? 0 : 0;
      if (now - lastAccess > policy.maxAgeMs) {
        return concept;
      }
    }
    return concepts.reduce((oldest, c) => {
      const t = 'lastAccessTime' in c ? c.lastAccessTime ?? 0 : 0;
      const ot = 'lastAccessTime' in oldest ? oldest.lastAccessTime ?? 0 : 0;
      return t < ot ? c : oldest;
    }, concepts[0]);
  }

  private selectByComposite(concepts: Concept[], scorer: MemoryScorer): Concept | undefined {
    const policy = this.policy as { type: 'composite'; weights: { priority: number; age: number } };
    let worst: Concept | undefined;
    let worstScore = Infinity;
    for (const concept of concepts) {
      const score = scorer.score(concept);
      const lastAccess = 'lastAccessTime' in concept ? concept.lastAccessTime ?? 0 : 0;
      const compositeScore = score * policy.weights.priority + (Date.now() - lastAccess) * policy.weights.age;
      if (compositeScore > worstScore) {
        worstScore = compositeScore;
        worst = concept;
      }
    }
    return worst;
  }
}