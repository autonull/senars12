import { createLogger } from '@senars/core/logger';
import type { Concept, Memory } from '../../memory';
import type { ComponentMetadata } from '../types.js';
import type { Term } from '../../terms';
import { type Truth, termsEqual } from '../../terms';
import type { Task, TaskType } from '../../types';
import type { Strategy } from '../types.js';
import { createStrategy } from '../../reason/strategies/base';
import { TermLinkStrategy as RealTermLinkStrategy } from './term-link';
import { SemanticStrategy as RealSemanticStrategy } from './semantic';
import { extractSymbols } from '../../terms';

const logger = createLogger({ scope: 'Strategies' });

const withMeta = <T extends Strategy>(strategy: T, description: string): T => {
  (strategy as unknown as { metadata: ComponentMetadata }).metadata = {
    name: strategy.name,
    description,
  };
  return strategy;
};

const createTask = (term: Term, type: TaskType, truth: Truth, priority: number): Task => ({
  term,
  type,
  truth,
  budget: { priority, durability: 0.8, quality: 0.9, cycles: 0, depth: 0 },
  stamp: Object.freeze({
    id: '',
    creationTime: 0 as any,
    source: 'INPUT' as const,
    derivations: [],
    depth: 0,
  }),
  occurrenceTime: 0 as any,
  derived: false,
});

const createBeliefTask = (term: Term, truth: Truth, priority: number): Task =>
  createTask(term, 'belief', truth, priority);

export const ResolutionStrategy: Strategy = withMeta(
  createStrategy({
    name: 'resolution',
    sampleSize: 15,
    filter: (c: Concept) => c.term.kind === 'inheritance',
    limit: 5,
  }),
  'Inheritance-focused resolution strategy'
);

export const GoalDrivenStrategy: Strategy = withMeta(
  createStrategy({
    name: 'goal-driven',
    sampleSize: 20,
    truthFilter: (truth) => truth.f > 0.7,
    limit: 5,
  }),
  'Prioritize high-confidence beliefs related to goals'
);

export const AnalogicalStrategy: Strategy = {
  metadata: {
    name: 'analogical',
    description: 'Match inheritance terms with overlapping subject/predicate',
  },
  name: 'analogical',
  selectSecondary(task, memory) {
    const results: Task[] = [];
    const concepts = memory.sample(15);

    for (const concept of concepts) {
      if (termsEqual(concept.term, task.term) || concept.term.kind !== 'inheritance') continue;

      const belief = concept.beliefBag.peek();
      if (!belief?.truth) continue;

      const taskTerm = task.term;
      if (taskTerm.kind === 'inheritance' && concept.term.kind === 'inheritance') {
        const [taskSub, taskPred] = taskTerm.args || [];
        const [conceptSub, conceptPred] = concept.term.args || [];

        const hasOverlap =
          (taskSub && conceptSub && termsEqual(taskSub, conceptSub)) ||
          (taskSub && conceptPred && termsEqual(taskSub, conceptPred)) ||
          (taskPred && conceptSub && termsEqual(taskPred, conceptSub)) ||
          (taskPred && conceptPred && termsEqual(taskPred, conceptPred));

        if (!hasOverlap) continue;
      }

      results.push(createBeliefTask(concept.term, belief.truth, concept.priority));
      if (results.length >= 3) break;
    }

    return results;
  },
};

export const TermLinkStrategy: Strategy = new RealTermLinkStrategy({ minLinkPriority: 0.3, maxLinks: 20 });

export const SampledStrategy: Strategy = withMeta(
  createStrategy({
    name: 'sampled',
    sampleSize: 20,
    limit: 5,
  }),
  'Generic sampled secondary selection'
);

export const DecompositionStrategy: Strategy = {
  metadata: { name: 'decomposition', description: 'Decompose conjunctions into component beliefs' },
  name: 'decomposition',
  selectSecondary(task, memory) {
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
  },
};

export const DefaultFormationStrategy: Strategy = withMeta(
  createStrategy({
    name: 'default-formation',
    sampleSize: 10,
    limit: 5,
  }),
  'Default premise formation with small sample'
);

export const BagStrategy: Strategy = withMeta(
  createStrategy({
    name: 'bag',
    sampleSize: 10,
    limit: 10,
    filter: (c: Concept, task: Task) => {
      const atoms1 = extractSymbols(task.term);
      const atoms2 = extractSymbols(c.term);
      for (const a of atoms1) {
        if (atoms2.has(a)) return true;
      }
      return false;
    },
    truthFilter: (belief, task: Task) => {
      const taskStamp = task.stamp;
      if (!taskStamp) return true;
      return true;
    },
  }),
  'Bag-based premise selection with shared atoms and no stamp overlap'
);

export const ExhaustiveStrategy: Strategy = withMeta(
  createStrategy({
    name: 'exhaustive',
    sampleSize: 100,
    limit: 100,
    filter: (c: Concept, task: Task) => {
      const atoms1 = extractSymbols(task.term);
      const atoms2 = extractSymbols(c.term);
      for (const a of atoms1) {
        if (atoms2.has(a)) return true;
      }
      return false;
    },
  }),
  'Exhaustive premise selection with shared atoms'
);

export const SemanticStrategy: Strategy = new RealSemanticStrategy({
  minSimilarity: 0.6,
  maxResults: 10,
  linkWeight: 0.5,
  embeddingWeight: 0.3,
  priorityWeight: 0.2,
});

export class CompositeStrategy implements Strategy {
  readonly metadata: ComponentMetadata = {
    name: 'composite',
    description: 'Combine multiple strategies with weights',
  };
  readonly name = 'composite';

  constructor(
    private strategies: Strategy[],
    private mode: 'sequential' | 'parallel' | 'weighted' = 'sequential',
    private weights?: number[]
  ) {}

  selectSecondary(task: Task, memory: Memory): Task[] {
    const allResults: Task[] = [];

    for (const strategy of this.strategies) {
      try {
        const results = strategy.selectSecondary(task, memory);
        allResults.push(...results);
      } catch (error) {
        logger.warn(`Strategy ${strategy.name} failed: ${error}`);
      }
    }

    if (this.mode === 'sequential' || this.mode === 'parallel') {
      return allResults;
    }

    const weightedResults = new Map<string, Task>();

    for (const strategy of this.strategies) {
      const results = strategy.selectSecondary(task, memory);

      for (const result of results) {
        const key =
          result.term.kind === 'atom' ? result.term.symbol : `${result.term.kind}-${Date.now()}`;
        if (!weightedResults.has(key)) {
          weightedResults.set(key, result);
        }
      }
    }

    return Array.from(weightedResults.values());
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

  selectSecondary(task: Task, memory: Memory): Task[] {
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

  selectSecondary(task: Task, memory: Memory): Task[] {
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

export { PrologResolutionStrategy, createPrologResolutionStrategy } from './prolog-resolution';