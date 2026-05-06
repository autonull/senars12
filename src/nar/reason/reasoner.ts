import type { Task } from '../task/task.js';
import { Memory } from '../memory/memory.js';
import { RuleProcessor } from '../rules/processor.js';
import type { Strategy } from './strategy.js';
import { Stamp } from '../terms/stamp.js';

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

  constructor(memory: Memory, processor: RuleProcessor, strategy: Strategy, config: ReasonerConfig) {
    this.memory = memory;
    this.processor = processor;
    this.strategy = strategy;
    this.config = config;
  }

  async step(timeoutMs = 5000, maxResults = 100): Promise<Task[]> {
    const results: Task[] = [];
    const startTime = Date.now();

    for (const concept of this.memory.sample(100)) {
      if (Date.now() - startTime > timeoutMs || results.length >= maxResults) break;

      const belief = concept.beliefBag.peek();
      const task: Task = {
        term: concept.term,
        type: 'belief',
        truth: belief?.truth ?? { f: 0.5, c: 0.9 },
        budget: { priority: concept.priority, durability: 0.8, quality: 0.9, cycles: 0, depth: 0 },
        stamp: Stamp.createInput(),
        occurrenceTime: 0,
        derived: false
      };

      for (const secondary of this.strategy.selectSecondary(task, this.memory)) {
        for (const d of this.processor.processSync(task.term, secondary.term)) {
          results.push(this.createDerivedTask(d));
        }
      }
    }

    return results;
  }

  private createDerivedTask(d: any): Task {
    const now = Date.now();
    return {
      term: d.term,
      type: 'belief',
      truth: d.truth,
      budget: { priority: d.priority, durability: 0.8, quality: 0.9, cycles: 0, depth: 0 },
      stamp: Object.freeze({
        id: `${now}-${Math.random().toString(36).slice(2, 9)}`,
        creationTime: now,
        source: 'DERIVED' as const,
        derivations: [...d.stamp.derivations, d.stamp.id],
        depth: d.stamp.depth + 1
      }),
      occurrenceTime: now,
      derived: true
    };
  }
}