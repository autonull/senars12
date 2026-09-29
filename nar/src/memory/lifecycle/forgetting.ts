import { maxBy, mean, minBy } from '@senars/util';

import type { Concept } from '../concept.js';
import type { MemoryScorer } from '../pressure/scorer.js';
import { SATURATION_COUNT } from '../../constants.js';
import { clamp01 } from '../../utils';

export type ForgettingPolicy =
  | 'fifo'
  | 'lowest-priority'
  | 'forgetting-curve'
  | { type: 'age'; maxAgeMs: number }
  | { type: 'composite'; weights: { priority: number; age: number } };

export interface ForgettingHooks {
  beforeForget?: (concept: Concept) => boolean;
  afterForget?: (concept: Concept) => void;
  shouldForgetAdaptive?: (concept: Concept, load: number) => number;
}

export interface ForgettingConfig {
  policy: ForgettingPolicy;
  enableAdaptive?: boolean;
  enableSemantic?: boolean;
  hooks?: ForgettingHooks;
  systemLoad?: () => number;
}

export class Forgetting {
  private readonly policy: ForgettingPolicy;
  private readonly enableAdaptive: boolean;
  private readonly enableSemantic: boolean;
  private readonly hooks?: ForgettingHooks;
  private readonly systemLoadFn?: () => number;
  private currentLoad = 0;
  private policySelectors: Record<
    string,
    (concepts: Concept[], scorer: MemoryScorer) => Concept | undefined
  > = {
    fifo: (concepts) => this.findOldest(concepts),
    'lowest-priority': (concepts) => this.selectLowestPriority(concepts),
    'forgetting-curve': (concepts, scorer) => this.selectByForgettingCurve(concepts, scorer),
    age: (concepts) => this.selectByAge(concepts),
    composite: (concepts, scorer) => this.selectByComposite(concepts, scorer),
  };

  constructor(config: ForgettingConfig | ForgettingPolicy = 'fifo') {
    if (typeof config === 'string' || (typeof config === 'object' && !('policy' in config))) {
      this.policy = config as ForgettingPolicy;
      this.enableAdaptive = false;
      this.enableSemantic = false;
    } else {
      const cfg = config as ForgettingConfig;
      this.policy = cfg.policy;
      this.enableAdaptive = cfg.enableAdaptive ?? false;
      this.enableSemantic = cfg.enableSemantic ?? false;
      this.hooks = cfg.hooks;
      this.systemLoadFn = cfg.systemLoad;
    }
  }

  setSystemLoad(load: number): void {
    this.currentLoad = load;
  }

  selectVictim(concepts: Concept[], scorer: MemoryScorer): Concept | undefined {
    if (concepts.length === 0) return undefined;

    const load = this.systemLoadFn?.() ?? this.currentLoad;
    const adaptiveFactor = this.enableAdaptive ? load : 0;

    let candidates = [...concepts];

    const hooks = this.hooks;
    if (hooks?.beforeForget) {
      candidates = candidates.filter((concept) => {
        const shouldForget = hooks.beforeForget?.(concept);
        return shouldForget !== false;
      });
    }

    if (this.enableSemantic && candidates.length > 1) {
      candidates = this.filterBySemanticConnectivity(candidates);
    }

    let victim: Concept | undefined;

    if (this.enableAdaptive && adaptiveFactor > 0.5) {
      victim = this.selectAdaptive(candidates, scorer, adaptiveFactor);
    } else if (typeof this.policy === 'string') {
      victim = this.policySelectors[this.policy]?.(candidates, scorer);
    } else if (typeof this.policy === 'object' && 'type' in this.policy) {
      victim = this.policySelectors[this.policy.type]?.(candidates, scorer);
    }

    if (victim && this.hooks?.afterForget) {
      this.hooks.afterForget(victim);
    }

    return victim;
  }

  private selectAdaptive(
    concepts: Concept[],
    scorer: MemoryScorer,
    load: number
  ): Concept | undefined {
    const scored = concepts.map((concept) => {
      const baseScore = scorer.score(concept);
      const connectivity = this.getConnectivity(concept);
      const timeDecay = Math.exp(-0.001 * (Date.now() - concept.createdAt));
      const loadFactor = 1 + load * 0.5;

      const adaptiveScore = baseScore * (1 - connectivity) * timeDecay * loadFactor;
      return { concept, score: adaptiveScore };
    });

    return maxBy(scored, (s) => s.score)?.concept;
  }

  private filterBySemanticConnectivity(concepts: Concept[]): Concept[] {
    const connectivity = concepts.map((concept) => ({
      concept,
      connectivity: this.getConnectivity(concept),
    }));

    const avgConnectivity =
      mean(connectivity, (c) => c.connectivity);

    const lowConnectivity = connectivity.filter((c) => c.connectivity < avgConnectivity);

    if (lowConnectivity.length > 0) {
      return lowConnectivity.map((c) => c.concept);
    }

    return concepts;
  }

  private getConnectivity(concept: Concept): number {
    let linkCount = 0;
    let linkStrength = 0;
    concept.forEachLink((link) => {
      linkCount++;
      linkStrength += link.strength;
    });
    const parents = concept.getParentConcepts();
    const children = concept.getChildConcepts();
    const totalConnections = linkCount + parents.length + children.length;
    if (totalConnections === 0) return 0;
    return clamp01((totalConnections + linkStrength) / SATURATION_COUNT);
  }

  private getLastAccess(concept: Concept): number {
    return 'lastAccessedAt' in concept ? (concept.lastAccessedAt ?? 0) : 0;
  }

  private selectLowestPriority(concepts: Concept[]): Concept | undefined {
    return minBy(concepts, (c) => c.priority);
  }

  private findOldest(concepts: Concept[]): Concept | undefined {
    return minBy(concepts, (c) => this.getLastAccess(c));
  }

  private selectByForgettingCurve(concepts: Concept[], scorer: MemoryScorer): Concept | undefined {
    if (concepts.length === 0) return undefined;
    // Ebbinghaus curve: retrievability = e^(-t / S). Forget the lowest.
    // t = elapsed seconds, floored so the exponent never divides by zero;
    // S = memory strength, floored and scaled to 1-100.
    const now = Date.now();
    return minBy(concepts, (c) => {
      const t = Math.max(0.1, (now - this.getLastAccess(c)) / 1000);
      const s = Math.max(0.01, scorer.scoreForForgetting(c) * 100);
      return Math.exp(-t / s);
    });
  }

  private selectByAge(concepts: Concept[]): Concept | undefined {
    const policy = this.policy as { type: 'age'; maxAgeMs: number };
    const now = Date.now();
    return (
      concepts.find((c) => now - this.getLastAccess(c) > policy.maxAgeMs) ??
      this.findOldest(concepts)
    );
  }

  private selectByComposite(concepts: Concept[], scorer: MemoryScorer): Concept | undefined {
    const policy = this.policy as { type: 'composite'; weights: { priority: number; age: number } };
    const now = Date.now();
    return maxBy(
      concepts,
      (c) => scorer.score(c) * policy.weights.priority + (now - this.getLastAccess(c)) * policy.weights.age
    );
  }
}
