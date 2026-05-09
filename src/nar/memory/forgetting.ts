import type {Concept} from './concept.js';
import type {MemoryScorer} from './scorer.js';

export type ForgettingPolicy =
    | 'fifo'
    | { type: 'priority'; threshold: number }
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

    constructor(config: ForgettingConfig | ForgettingPolicy = 'fifo') {
        if (typeof config === 'string' || typeof config === 'object' && !('policy' in config)) {
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

    private policySelectors: Record<string, (concepts: Concept[], scorer: MemoryScorer) => Concept | undefined> = {
        priority: (concepts) => this.selectByPriority(concepts),
        age: (concepts) => this.selectByAge(concepts),
        composite: (concepts, scorer) => this.selectByComposite(concepts, scorer)
    };

    selectVictim(concepts: Concept[], scorer: MemoryScorer): Concept | undefined {
        if (concepts.length === 0) return undefined;

        const load = this.systemLoadFn?.() ?? this.currentLoad;
        const adaptiveFactor = this.enableAdaptive ? load : 0;

        let candidates = [...concepts];

        const hooks = this.hooks;
        if (hooks?.beforeForget) {
            candidates = candidates.filter(concept => {
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
        } else if (this.policy === 'fifo') {
            victim = this.selectFifo(candidates);
        } else if (typeof this.policy === 'object' && 'type' in this.policy) {
            victim = this.policySelectors[this.policy.type]?.(candidates, scorer);
        }

        if (victim && this.hooks?.afterForget) {
            this.hooks.afterForget(victim);
        }

        return victim;
    }

    private selectAdaptive(concepts: Concept[], scorer: MemoryScorer, load: number): Concept | undefined {
        const scored = concepts.map(concept => {
            const baseScore = scorer.score(concept);
            const connectivity = this.getConnectivity(concept);
            const timeDecay = Math.exp(-0.001 * (Date.now() - concept.createdAt));
            const loadFactor = 1 + load * 0.5;

            const adaptiveScore = baseScore * (1 - connectivity) * timeDecay * loadFactor;
            return {concept, score: adaptiveScore};
        });

        scored.sort((a, b) => b.score - a.score);
        return scored[0]?.concept;
    }

    private filterBySemanticConnectivity(concepts: Concept[]): Concept[] {
        const connectivity = concepts.map(concept => ({
            concept,
            connectivity: this.getConnectivity(concept),
        }));

        const avgConnectivity =
            connectivity.reduce((sum, c) => sum + c.connectivity, 0) / connectivity.length;

        const lowConnectivity = connectivity.filter(c => c.connectivity < avgConnectivity);

        if (lowConnectivity.length > 0) {
            return lowConnectivity.map(c => c.concept);
        }

        return concepts;
    }

    private getConnectivity(concept: Concept): number {
        const links = concept.getLinks();
        const parents = concept.getParentConcepts();
        const children = concept.getChildConcepts();

        const totalConnections = links.length + parents.length + children.length;

        if (totalConnections === 0) return 0;

        const linkStrength = links.reduce((sum, link) => sum + link.strength, 0);
        return Math.min(1, (totalConnections + linkStrength) / 10);
    }

  private selectFifo(concepts: Concept[]): Concept | undefined {
    let oldest: Concept | undefined;
    let oldestTime = Infinity;
    for (const concept of concepts) {
      const lastAccess = 'lastAccessedAt' in concept ? concept.lastAccessedAt ?? 0 : 0;
      if (lastAccess < oldestTime) {
        oldestTime = lastAccess;
        oldest = concept;
      }
    }
    return oldest;
  }

    private selectByPriority(concepts: Concept[]): Concept | undefined {
        const policy = this.policy as { type: 'priority'; threshold: number };
        for (const concept of concepts) {
            if (concept.priority < policy.threshold) {
                return concept;
            }
        }
        return concepts.reduce((min, c) =>
            min && c.priority < min.priority ? c : min, concepts[0]
        );
    }

  private selectByAge(concepts: Concept[]): Concept | undefined {
    const policy = this.policy as { type: 'age'; maxAgeMs: number };
    const now = Date.now();
    for (const concept of concepts) {
      const lastAccess = 'lastAccessedAt' in concept ? concept.lastAccessedAt ?? 0 : 0;
      if (now - lastAccess > policy.maxAgeMs) {
        return concept;
      }
    }
    const first = concepts[0];
    if (!first) return undefined;
    return concepts.reduce((oldest, c) => {
      const t = 'lastAccessedAt' in c ? c.lastAccessedAt ?? 0 : 0;
      const ot = 'lastAccessedAt' in oldest ? oldest.lastAccessedAt ?? 0 : 0;
      return t < ot ? c : oldest;
    }, first);
  }

  private selectByComposite(concepts: Concept[], scorer: MemoryScorer): Concept | undefined {
    const policy = this.policy as { type: 'composite'; weights: { priority: number; age: number } };
    let worst: Concept | undefined;
    let worstScore = Infinity;
    for (const concept of concepts) {
      const score = scorer.score(concept);
      const lastAccess = 'lastAccessedAt' in concept ? concept.lastAccessedAt ?? 0 : 0;
      const compositeScore = score * policy.weights.priority + (Date.now() - lastAccess) * policy.weights.age;
      if (compositeScore > worstScore) {
        worstScore = compositeScore;
        worst = concept;
      }
        }
        return worst;
    }
}
