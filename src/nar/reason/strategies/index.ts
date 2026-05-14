import type {Strategy} from '../strategy.js';
import type {Task} from '../../types';
import type {Memory} from '../../memory';
import {createStrategy, createStrategy as createStrategyBase} from './base.js';
import {termsEqual, Truth} from '../../terms';
import {createTermLinkStrategy, TermLinkStrategy as TermLinkStrategyImpl} from './term-link.js';
import {createSemanticStrategy, SemanticStrategy as SemanticStrategyImpl} from './semantic.js';

export {createStrategy, createStrategyBase};
export {TermLinkStrategyImpl, createTermLinkStrategy, SemanticStrategyImpl, createSemanticStrategy};

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

export const GoalDrivenStrategy: Strategy = {
    name: 'goal-driven',
    selectSecondary(task, memory) {
        const results: Task[] = [];
        const concepts = memory.sample(20);

        for (const concept of concepts) {
            if (termsEqual(concept.term, task.term)) continue;

            const belief = concept.beliefBag.peek();
            if (!belief?.truth) continue;

            if (belief.truth.f <= 0.7) continue;

            results.push({
                term: concept.term,
                type: 'belief' as const,
                truth: belief.truth,
                budget: {priority: concept.priority, durability: 0.8, quality: 0.9, cycles: 0, depth: 0},
                stamp: Object.freeze({
                    id: '',
                    creationTime: 0,
                    source: 'INPUT' as const,
                    derivations: [],
                    depth: 0
                }),
                occurrenceTime: 0,
                derived: false
            });

            if (results.length >= 5) break;
        }

        return results;
    }
};

export const AnalogicalStrategy: Strategy = {
    name: 'analogical',
    selectSecondary(task, memory) {
        const results: Task[] = [];
        const concepts = memory.sample(15);

        for (const concept of concepts) {
            if (termsEqual(concept.term, task.term)) continue;
            if (concept.term.kind !== 'inheritance') continue;

            const belief = concept.beliefBag.peek();
            if (!belief?.truth) continue;

            const taskTerm = task.term;
            const conceptTerm = concept.term;

            if (taskTerm.kind === 'inheritance' && conceptTerm.kind === 'inheritance') {
                const taskSub = taskTerm.args?.[0];
                const taskPred = taskTerm.args?.[1];
                const conceptSub = conceptTerm.args?.[0];
                const conceptPred = conceptTerm.args?.[1];

                const hasOverlap = (taskSub && conceptSub && termsEqual(taskSub, conceptSub)) ||
                    (taskSub && conceptPred && termsEqual(taskSub, conceptPred)) ||
                    (taskPred && conceptSub && termsEqual(taskPred, conceptSub)) ||
                    (taskPred && conceptPred && termsEqual(taskPred, conceptPred));

                if (!hasOverlap) continue;
            }

            results.push({
                term: concept.term,
                type: 'belief' as const,
                truth: belief.truth,
                budget: {priority: concept.priority, durability: 0.8, quality: 0.9, cycles: 0, depth: 0},
                stamp: Object.freeze({
                    id: '',
                    creationTime: 0,
                    source: 'INPUT' as const,
                    derivations: [],
                    depth: 0
                }),
                occurrenceTime: 0,
                derived: false
            });

            if (results.length >= 3) break;
        }

        return results;
    }
};

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
            const truth = concept?.beliefBag.peek()?.truth ?? Truth.NEUTRAL;
            const priority = concept?.priority ?? 0.5;

            results.push({
                term: arg,
                type: 'belief' as const,
                truth,
                budget: {priority, durability: 0.8, quality: 0.9, cycles: 0, depth: 0},
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
    ) {
    }

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
            const _weight = this.weights?.[weightIndex] ?? 1;
            const results = strategy.selectSecondary(task, memory);

            for (const result of results) {
                const key = result.term.kind === 'atom' ? result.term.symbol : `${result.term.kind}-${Date.now()}`;
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
}

export class SwitchingStrategy implements Strategy {
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
