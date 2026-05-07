import type {Strategy} from '../strategy.js';
import type {Task} from '../../types/index.js';
import type {Memory} from '../../memory/memory.js';
import {createStrategy} from './base.js';
import {Truth} from '../../terms/truth.js';

export const PrologStrategy: Strategy = createStrategy({
  name: 'prolog',
  sampleSize: 20,
  limit: 5
});

export const ResolutionStrategy: Strategy = createStrategy({
  name: 'resolution',
  sampleSize: 15,
  filter: (c) => c.term.kind === 'inheritance',
  limit: 5
});

export const GoalDrivenStrategy: Strategy = createStrategy({
  name: 'goal-driven',
  sampleSize: 20,
  truthFilter: (t) => t?.f > 0.7,
  limit: 5
});

export const AnalogicalStrategy: Strategy = createStrategy({
  name: 'analogical',
  sampleSize: 15,
  filter: (c) => c.term.kind === 'inheritance',
  limit: 3
});

export const TermLinkStrategy: Strategy = createStrategy({
  name: 'term-link',
  sampleSize: 25,
  limit: 10
});

export const TaskMatchStrategy: Strategy = createStrategy({
  name: 'task-match',
  sampleSize: 20,
  limit: 5
});

export const DecompositionStrategy: Strategy = {
  name: 'decomposition',
  selectSecondary(task, memory) {
    const results: Task[] = [];
    if (task.term.kind !== 'conjunction') return results;

    for (const arg of task.term.args) {
      const concept = memory.getConcept(arg);
      if (!concept) continue;
      const belief = concept.beliefBag.peek();
      if (!belief) continue;

      results.push({
        term: arg,
        type: 'belief' as const,
        truth: belief.truth ?? Truth.NEUTRAL,
        budget: {priority: concept.priority, durability: 0.8, quality: 0.9, cycles: 0, depth: 0},
        stamp: Object.freeze({id: '', creationTime: 0, source: 'INPUT' as const, derivations: [], depth: 0}),
        occurrenceTime: 0,
        derived: false
      });
    }
    return results;
  }
};

export const DefaultFormationStrategy: Strategy = createStrategy({
  name: 'default-formation',
  sampleSize: 10,
  limit: 5
});

export class CompositeStrategy implements Strategy {
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
        console.warn(`Strategy ${strategy.name} failed:`, error);
      }
    }

    if (this.mode === 'sequential' || this.mode === 'parallel') {
      return allResults;
    }

    const weightedResults = new Map<string, Task>();
    let weightIndex = 0;
    
    for (const strategy of this.strategies) {
      const weight = this.weights?.[weightIndex] ?? 1;
      const results = strategy.selectSecondary(task, memory);
      
      for (const result of results) {
        const key = `${result.term.hash}`;
        if (!weightedResults.has(key)) {
          weightedResults.set(key, result);
        }
      }
      
      weightIndex++;
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
  readonly name = 'adaptive';
  private stats: Map<string, StrategyStats> = new Map();

  constructor(
    private strategies: Strategy[],
    private initialWeights?: number[]
  ) {
    this.resetStats();
  }

  private resetStats(): void {
    this.stats = new Map();
    for (const strategy of this.strategies) {
      this.stats.set(strategy.name, {
        pairsGenerated: 0,
        successfulDerivations: 0,
        effectiveness: 1.0
      });
    }
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
    currentStats.successfulDerivations += results.filter(r => r.derived).length;
    currentStats.effectiveness = currentStats.pairsGenerated > 0
      ? currentStats.successfulDerivations / currentStats.pairsGenerated
      : 1.0;
    this.stats.set(bestStrategy.name, currentStats);

    return results;
  }

  getStats(): Map<string, StrategyStats> {
    return new Map(this.stats);
  }
}
