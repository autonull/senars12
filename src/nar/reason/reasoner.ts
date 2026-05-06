import type { Task } from '../task/task.js';
import { Memory } from '../memory/memory.js';
import { RuleProcessor } from '../rules/processor.js';
import type { Strategy } from './strategy.js';

export interface ReasonerConfig {
    cpuThrottleMs: number;
    maxDerivationDepth: number;
    maxDerivationsPerStep: number;
}

export class Reasoner {
    private memory: Memory;
    private processor: RuleProcessor;
    private strategy: Strategy;
    private config: ReasonerConfig;

    constructor(
        memory: Memory,
        processor: RuleProcessor,
        strategy: Strategy,
        config: ReasonerConfig
    ) {
        this.memory = memory;
        this.processor = processor;
        this.strategy = strategy;
        this.config = config;
    }

    async step(timeoutMs = 5000, maxResults = 100): Promise<Task[]> {
        const results: Task[] = [];
        const startTime = Date.now();
        const concepts = this.memory.sample(100);

        for (const concept of concepts) {
            if (Date.now() - startTime > timeoutMs) break;
            if (results.length >= maxResults) break;

            const task: Task = {
                term: concept.term,
                type: 'belief',
                truth: (concept.beliefBag.peek() as any)?.truth ?? { f: 0.5, c: 0.9 },
                budget: { priority: concept.priority, durability: 0.8, quality: 0.9, cycles: 0, depth: 0 },
                stamp: Object.freeze({
                    id: '',
                    creationTime: 0,
                    source: 'INPUT' as const,
                    derivations: [],
                    depth: 0
                }),
                occurrenceTime: 0,
                derived: false
            };

            const secondaryTasks = this.strategy.selectSecondary(task, this.memory);

            for (const secondary of secondaryTasks) {
                const derivations = this.processor.processSync(
                    task.term, secondary.term
                );

                for (const d of derivations) {
                    const newStamp = Object.freeze({
                        id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
                        creationTime: Date.now(),
                        source: 'DERIVED' as const,
                        derivations: [...d.stamp.derivations, d.stamp.id],
                        depth: d.stamp.depth + 1
                    });
                    results.push({
                        term: d.term,
                        type: 'belief',
                        truth: d.truth,
                        budget: { priority: d.priority, durability: 0.8, quality: 0.9, cycles: 0, depth: 0 },
                        stamp: newStamp,
                        occurrenceTime: Date.now(),
                        derived: true
                    });
                }
            }
        }

        return results;
    }
}