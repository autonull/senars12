import { createLogger } from '@senars/core/logger';
import type { Concept } from '../../memory/concept.js';
import type { MemoryView } from '../../memory/view.js';
import { createStrategy, type StrategyConfig } from '../../reason/strategies/base';
import { termKey, type Term, type Truth } from '../../terms';
import type { Task } from '../../types';
import { createBeliefTask } from '../../types';
import type { FilterSpec } from './primitives.js';
import type { PremiseOverrides } from './config.js';
import type { ComponentMetadata, Strategy } from '../types.js';
import {
  EmbeddingLinkStrategy as RealEmbeddingLinkStrategy,
  TermLinkStrategy as RealTermLinkStrategy,
} from './term-link';

const logger = createLogger({ scope: 'Strategies' });

const withMeta = <T extends Strategy>(strategy: T, description: string): T => {
  (strategy as unknown as { metadata: ComponentMetadata }).metadata = {
    name: strategy.name,
    description,
  };
  return strategy;
};

export type PremisePrimitiveSpec = { description: string } & Omit<
  StrategyConfig,
  'name' | 'description' | 'filter' | 'truthFilter' | 'sampleSize' | 'limit'
> & { sampleSize: number; limit: number };

/**
 * The primitive premise strategies, declared once.
 *
 * `sampleSize` and `limit` are the strategy's *configuration* (TODO27 §2.1):
 * `createPremiseStrategy` reads them from a validated config bag, and the
 * exported singletons below are the `defaultConfig` instances of the same
 * table. One declaration, so a default and a configured variant can never drift.
 */
export const PREMISE_PRIMITIVES = {
  resolution: {
    description: 'Inheritance-focused resolution strategy',
    sampleSize: 15,
    limit: 5,
    filters: ['inheritanceOnly'],
  },
  'goal-driven': {
    description: 'Prioritize high-confidence beliefs related to goals',
    sampleSize: 20,
    limit: 5,
    filters: [{ highConfidence: 0.7 }],
  },
  analogical: {
    description: 'Match inheritance terms with overlapping subject/predicate',
    sampleSize: 15,
    limit: 3,
    filters: ['inheritanceOnly', 'inheritanceOverlap'],
  },
  sampled: {
    description: 'Generic sampled secondary selection',
    sampleSize: 20,
    limit: 5,
  },
  'default-formation': {
    description: 'Default premise formation with small sample',
    sampleSize: 10,
    limit: 5,
    filters: ['sharedAtoms'],
  },
  bag: {
    description: 'Bag-based premise selection with shared atoms and no stamp overlap',
    sampleSize: 10,
    limit: 10,
    filters: ['sharedAtoms', 'noStampOverlap'],
  },
  exhaustive: {
    description: 'Exhaustive premise selection with shared atoms',
    sampleSize: 100,
    limit: 100,
    filters: ['sharedAtoms'],
  },
  semantic: {
    description: 'Semantic similarity via linear(link, embed, priority)',
    // Large sampleSize to capture all concepts (the `concepts` source ignores it).
    sampleSize: 100,
    limit: 10,
    // No default sharedAtoms filter: semantic similarity does not require shared atoms.
    filters: [] as FilterSpec[],
    source: 'concepts' as const,
    scorer: { linear: { link: 0.5, embed: 0.3, pri: 0.2 } },
    minScore: 0.6,
  },
} as const satisfies Record<string, PremisePrimitiveSpec>;

/** A primitive premise strategy with its sampling pipeline supplied by config. */
export const createPremiseStrategy = (
  name: keyof typeof PREMISE_PRIMITIVES,
  overrides: PremiseOverrides
): Strategy => {
  const { description: _description, ...primitives } = PREMISE_PRIMITIVES[name];
  return createStrategy({ ...primitives, name, ...overrides });
};

const primitive = <N extends keyof typeof PREMISE_PRIMITIVES>(name: N): Strategy => {
  const spec = PREMISE_PRIMITIVES[name];
  return withMeta(
    createPremiseStrategy(name, { sampleSize: spec.sampleSize, limit: spec.limit }),
    spec.description
  );
};

export const ResolutionStrategy: Strategy = primitive('resolution');

export const GoalDrivenStrategy: Strategy = primitive('goal-driven');

export const AnalogicalStrategy: Strategy = primitive('analogical');

export const TermLinkStrategy: Strategy = withMeta(
  new RealTermLinkStrategy({ minStrength: 0.3, limit: 20 }),
  'Term-link premises plus the subject and predicate link neighbourhoods'
);

export const EmbeddingLinkStrategy: Strategy = withMeta(
  new RealEmbeddingLinkStrategy({ minStrength: 0.3, limit: 20 }),
  'Semantic premises from the embedding layer\'s similarity links'
);

export const SampledStrategy: Strategy = primitive('sampled');

export class DecompositionStrategy implements Strategy {
  readonly metadata: ComponentMetadata = {
    name: 'decomposition',
    description: 'Decompose conjunctions into component beliefs',
  };
  readonly name = 'decomposition';

  selectSecondary(task: Task, memory: MemoryView): Task[] {
    if (task.term.kind !== 'conjunction') return [];

    return task.term.args
      .map((arg) => {
        const concept = memory.getConcept(arg);
        if (!concept) return null;
        const belief = concept.beliefBag.peek();
        if (!belief?.truth) return null;
        return createBeliefTask(arg, belief.truth, concept.priority);
      })
      .filter((t): t is Task => t !== null);
  }
}

export const DefaultFormationStrategy: Strategy = primitive('default-formation');

export const BagStrategy: Strategy = primitive('bag');

export const ExhaustiveStrategy: Strategy = primitive('exhaustive');

export const SemanticStrategy: Strategy = primitive('semantic');

/**
 * How several premise strategies combine into one premise set.
 * - `concatenate`: every strategy's premises, in order
 * - `dedup`: one premise per term, keeping the highest-priority claim
 */
export type CompositeMode = 'concatenate' | 'dedup';

export class CompositeStrategy implements Strategy {
  readonly metadata: ComponentMetadata = {
    name: 'composite',
    description: 'Combine multiple premise strategies',
  };
  readonly name = 'composite';

  constructor(
    private strategies: Strategy[],
    private mode: CompositeMode = 'concatenate'
  ) {}

  selectSecondary(task: Task, memory: MemoryView): Task[] {
    const contributions = this.strategies.flatMap((strategy) => {
      try {
        return strategy.selectSecondary(task, memory);
      } catch (error) {
        logger.warn(`Strategy ${strategy.name} failed: ${error}`);
        return [];
      }
    });

    if (this.mode !== 'dedup') return contributions;

    // Highest link/priority wins; `termKey` is the canonical structural identity.
    const strongest = new Map<string, Task>();
    for (const candidate of contributions) {
      const key = termKey(candidate.term);
      const held = strongest.get(key);
      if (!held || candidate.budget.priority > held.budget.priority) strongest.set(key, candidate);
    }
    return [...strongest.values()];
  }
}

interface StrategyStats {
  pairsGenerated: number;
  successfulDerivations: number;
  effectiveness: number;
}

export class AdaptiveStrategy implements Strategy {
  readonly metadata: ComponentMetadata = {
    name: 'adaptive',
    description: 'Select best strategy based on past effectiveness',
  };
  readonly name = 'adaptive';
  private stats: Map<string, StrategyStats> = new Map();

  constructor(
    private strategies: Strategy[],
    private initialWeights?: number[]
  ) {
    this.resetStats();
  }

  selectSecondary(task: Task, memory: MemoryView): Task[] {
    const sortedStrategies = [...this.strategies].sort((a, b) => {
      const statsA = this.stats.get(a.name)!;
      const statsB = this.stats.get(b.name)!;
      return statsB.effectiveness - statsA.effectiveness;
    });

    const bestStrategy = sortedStrategies[0];
    if (!bestStrategy) return [];

    const results = bestStrategy.selectSecondary(task, memory);

    const currentStats = this.stats.get(bestStrategy.name)!;
    currentStats.pairsGenerated += results.length;
    currentStats.successfulDerivations += results.filter((r) => r.derived).length;
    currentStats.effectiveness =
      currentStats.pairsGenerated > 0
        ? currentStats.successfulDerivations / currentStats.pairsGenerated
        : 1.0;
    this.stats.set(bestStrategy.name, currentStats);

    return results;
  }

  getStats(): Map<string, StrategyStats> {
    return new Map(this.stats);
  }

  private resetStats(): void {
    this.stats = new Map();
    for (const strategy of this.strategies) {
      this.stats.set(strategy.name, {
        pairsGenerated: 0,
        successfulDerivations: 0,
        effectiveness: 1.0,
      });
    }
  }
}

export class SwitchingStrategy implements Strategy {
  readonly metadata: ComponentMetadata = {
    name: 'switching',
    description: 'Cycle through strategies at fixed intervals',
  };
  readonly name = 'switching';
  private currentIndex = 0;
  private readonly switchInterval: number;
  private callCount = 0;

  constructor(
    private strategies: Strategy[],
    switchInterval = 10
  ) {
    this.switchInterval = switchInterval;
  }

  selectSecondary(task: Task, memory: MemoryView): Task[] {
    const strategy = this.strategies[this.currentIndex];
    if (!strategy) return [];

    this.callCount++;
    if (this.callCount % this.switchInterval === 0) {
      this.currentIndex = (this.currentIndex + 1) % this.strategies.length;
    }

    return strategy.selectSecondary(task, memory);
  }

  reset(): void {
    this.currentIndex = 0;
    this.callCount = 0;
  }

  getCurrentStrategy(): Strategy | undefined {
    return this.strategies[this.currentIndex];
  }
}

export { createPrologResolutionStrategy, PrologResolutionStrategy } from './prolog-resolution';
