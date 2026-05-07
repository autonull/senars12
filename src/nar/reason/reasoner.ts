/**
 * Reasoner for performing inference steps
 */

import type { Task } from '../task/task.js';
import { createBudget } from '../types/core.js';
import { Memory } from '../memory/memory.js';
import { RuleProcessor } from '../rules/processor.js';
import type { Strategy } from './strategy.js';
import { Stamp } from '../terms/stamp.js';
import { Truth } from '../terms/truth.js';
import type { CoreConfig } from '../types/core.js';

export interface ReasonerConfig extends Pick<CoreConfig, 'cpuThrottleMs' | 'maxDerivationDepth' | 'maxDerivationsPerStep'> {}

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

    for (const concept of this.memory.sample(100)) {
      if (Date.now() - startTime > timeoutMs || results.length >= maxResults) break;

      const belief = concept.beliefBag.peek();
      const task: Task = {
        term: concept.term,
        type: 'belief',
        truth: belief?.truth ?? Truth.NEUTRAL,
        budget: createBudget(concept.priority),
        stamp: Stamp.createInput(),
        occurrenceTime: 0,
        derived: false
      };

      for (const secondary of this.strategy.selectSecondary(task, this.memory)) {
        for (const d of this.processor.processSync(task.term, secondary.term)) {
          results.push(this.createDerivedTask(d, now()));
        }
      }
    }

    return results;
  }

  private createDerivedTask(d: any, now: number): Task {
    const derivedStamp = Stamp.derive([d.stamp], 'DERIVED');
    return {
      term: d.term,
      type: 'belief',
      truth: d.truth,
      budget: createBudget(d.priority),
      stamp: derivedStamp ?? Stamp.createInput(),
      occurrenceTime: now,
      derived: true
    };
  }
}

const now = () => Date.now();
